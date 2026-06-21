import {
  finalizeEvent,
  nip10,
  verifyEvent,
  type Filter,
} from "nostr-tools";
import type { SubCloser } from "nostr-tools/abstract-pool";
import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import WebSocket from "ws";
import { findQuotedEvents, formatQuotedNote } from "./quoted-notes.js";
import type { ConversationMessage, NostrEvent } from "./types.js";

useWebSocketImplementation(WebSocket);

export class NostrClient {
  private readonly pool = new SimplePool();

  constructor(
    private readonly relays: string[],
    private readonly privateKey: Uint8Array,
    readonly publicKey: string,
  ) {}

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
    });
  }

  async buildConversation(
    event: NostrEvent,
    maxEvents: number,
  ): Promise<ConversationMessage[]> {
    const chain: NostrEvent[] = [event];
    const visited = new Set([event.id]);
    let cursor = event;

    while (chain.length < maxEvents) {
      const parentId = nip10.parse(cursor).reply?.id ?? nip10.parse(cursor).root?.id;
      if (!parentId || visited.has(parentId)) break;

      const parent = await this.pool.get(this.relays, { ids: [parentId] });
      if (!parent || !verifyEvent(parent)) break;

      chain.push(parent);
      visited.add(parent.id);
      cursor = parent;
    }

    const chronologicalChain = chain.reverse();
    const messages = chronologicalChain.map((note) => ({
      role: note.pubkey === this.publicKey ? "assistant" : "user",
      content: note.content,
    }) satisfies ConversationMessage);

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

    if (quotedMessages.length === 0) return messages;

    const triggeringMessage = messages.pop();
    return triggeringMessage
      ? [...messages, ...quotedMessages, triggeringMessage]
      : quotedMessages;
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

    await Promise.any(this.pool.publish(this.relays, event));
    return event;
  }

  close(): void {
    this.pool.close(this.relays);
  }
}
