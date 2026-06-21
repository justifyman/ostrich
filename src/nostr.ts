import {
  finalizeEvent,
  nip10,
  verifyEvent,
  type Filter,
} from "nostr-tools";
import type { SubCloser } from "nostr-tools/abstract-pool";
import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import WebSocket from "ws";
import { logger } from "./logger.js";
import { findQuotedEvents, formatQuotedNote } from "./quoted-notes.js";
import { withRetry } from "./retry.js";
import {
  formatThreadMessages,
  getParentPointer,
  getRelayHints,
} from "./thread-context.js";
import type {
  ConversationContext,
  ConversationMessage,
  NostrEvent,
} from "./types.js";

useWebSocketImplementation(WebSocket);

export class NostrClient {
  private readonly pool: SimplePool;

  constructor(
    private readonly relays: string[],
    private readonly privateKey: Uint8Array,
    readonly publicKey: string,
    private readonly retryAttempts = 3,
    private readonly retryDelayMs = 750,
  ) {
    this.pool = new SimplePool({ enableReconnect: true });
    this.pool.trackRelays = true;
    this.pool.onRelayConnectionSuccess = (url: string) => {
      logger.info("relay connected", { relay: url });
    };
    this.pool.onRelayConnectionFailure = (url: string) => {
      logger.warn("relay connection failed", { relay: url });
    };
  }

  listen(onEvent: (event: NostrEvent) => void): SubCloser {
    const filter: Filter = {
      kinds: [1],
      "#p": [this.publicKey],
      since: Math.floor(Date.now() / 1_000) - 10,
    };

    return this.pool.subscribeMany(this.relays, filter, {
      onevent: (event) => {
        if (verifyEvent(event)) onEvent(event);
      },
      onclose: (reasons) => {
        logger.warn("relay subscription closed", { reasons });
      },
    });
  }

  async buildConversation(
    event: NostrEvent,
    maxEvents: number,
  ): Promise<ConversationContext> {
    const chain: NostrEvent[] = [event];
    const visited = new Set([event.id]);
    let cursor = event;
    const initialParent = getParentPointer(event);
    let parentLoaded = false;

    while (chain.length < maxEvents) {
      const pointer = getParentPointer(cursor);
      if (!pointer || visited.has(pointer.id)) break;

      const lookupRelays = [
        ...new Set([
          ...getRelayHints(cursor, pointer),
          ...this.getSeenRelayUrls(cursor.id),
          ...this.relays,
        ]),
      ];
      let parent: NostrEvent;

      try {
        parent = await withRetry(
          async () => {
            const found = await this.pool.get(
              lookupRelays,
              { ids: [pointer.id] },
              { maxWait: 4_000 },
            );
            if (!found || !verifyEvent(found)) {
              throw new Error(`parent event ${pointer.id} was not found`);
            }
            return found;
          },
          {
            attempts: this.retryAttempts,
            initialDelayMs: this.retryDelayMs,
            operationName: "parent note lookup",
            onRetry: ({ attempt, delayMs }) => {
              logger.warn("retrying parent note lookup", {
                parentId: pointer.id,
                attempt,
                delayMs,
                relays: lookupRelays.length,
              });
            },
          },
        );
      } catch (error) {
        logger.warn("parent note unavailable", {
          parentId: pointer.id,
          relays: lookupRelays.length,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      chain.push(parent);
      if (cursor.id === event.id) parentLoaded = true;
      visited.add(parent.id);
      cursor = parent;
    }

    const chronologicalChain = chain.reverse();
    const messages = formatThreadMessages(chronologicalChain, this.publicKey);

    const chainIds = new Set(chronologicalChain.map((note) => note.id));
    const quotedPointers = findQuotedEvents(event).filter(
      (pointer) => !chainIds.has(pointer.id),
    );
    const quotedNotes = await Promise.all(
      quotedPointers.map(async (pointer) => {
        const lookupRelays = [...new Set([...pointer.relays, ...this.relays])];
        const quoted = await this.pool.get(lookupRelays, { ids: [pointer.id] });
        return quoted && verifyEvent(quoted) ? quoted : null;
      }),
    );

    const quotedMessages: ConversationMessage[] = quotedNotes.flatMap((note) =>
      note
        ? [
            {
              role: "user" as const,
              content: formatQuotedNote(note),
            },
          ]
        : [],
    );

    if (quotedMessages.length === 0) {
      return {
        messages,
        parentExpected: Boolean(initialParent),
        parentLoaded,
      };
    }

    const triggeringMessage = messages.pop();
    return {
      messages: triggeringMessage
        ? [...messages, ...quotedMessages, triggeringMessage]
        : quotedMessages,
      parentExpected: Boolean(initialParent),
      parentLoaded,
    };
  }

  async publishReply(target: NostrEvent, content: string): Promise<NostrEvent> {
    const references = nip10.parse(target);
    const rootId = references.root?.id ?? target.id;
    const tags: string[][] = [
      ["e", rootId, "", "root"],
      ["e", target.id, "", "reply"],
      ["p", target.pubkey],
    ];

    const event = finalizeEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1_000),
        tags,
        content,
      },
      this.privateKey,
    );

    await withRetry(
      () => Promise.any(this.pool.publish(this.relays, event)),
      {
        attempts: this.retryAttempts,
        initialDelayMs: this.retryDelayMs,
        operationName: "Nostr publish",
        onRetry: ({ attempt, delayMs, error }) => {
          logger.warn("retrying Nostr publish", {
            eventId: event.id,
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
    );
    return event;
  }

  close(): void {
    this.pool.close(this.relays);
  }

  private getSeenRelayUrls(eventId: string): string[] {
    return [...(this.pool.seenOn.get(eventId) ?? [])].map((relay) => relay.url);
  }
}
