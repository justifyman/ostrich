import { nip10 } from "nostr-tools";
import type { EventPointer } from "nostr-tools/nip19";
import type { ConversationMessage, NostrEvent } from "./types.js";

function isRelayUrl(value: string | undefined): value is string {
  if (!value || (!value.startsWith("wss://") && !value.startsWith("ws://"))) {
    return false;
  }

  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash && !value.includes("|");
  } catch {
    return false;
  }
}

export function getParentPointer(event: NostrEvent): EventPointer | undefined {
  if (event.kind === 1111) {
    const parent = event.tags.find(
      ([name, value]) => name === "e" && /^[0-9a-f]{64}$/i.test(value ?? ""),
    );
    if (!parent?.[1]) return undefined;

    return {
      id: parent[1],
      relays: isRelayUrl(parent[2]) ? [parent[2]] : [],
      author: parent[3],
    };
  }

  const references = nip10.parse(event);
  return references.reply ?? references.root;
}

export function getRelayHints(
  event: NostrEvent,
  pointer?: EventPointer,
): string[] {
  const hints = new Set<string>();

  for (const relay of pointer?.relays ?? []) {
    if (isRelayUrl(relay)) hints.add(relay);
  }

  for (const [name, , relay] of event.tags) {
    if (
      (name === "e" ||
        name === "E" ||
        name === "p" ||
        name === "P" ||
        name === "q") &&
      isRelayUrl(relay)
    ) {
      hints.add(relay);
    }
  }

  return [...hints];
}

export function formatThreadMessages(
  chain: NostrEvent[],
  botPublicKey: string,
): ConversationMessage[] {
  return chain.map((note, index) => {
    const isCurrentRequest = index === chain.length - 1;
    const isParent = index === chain.length - 2;
    const label = isCurrentRequest
      ? "Current request"
      : isParent
        ? "Parent note being replied to"
        : "Earlier thread note";

    return {
      role: note.pubkey === botPublicKey ? "assistant" : "user",
      content: `[${label}; author ${note.pubkey}]\n${note.content}\n[End ${label.toLowerCase()}]`,
    };
  });
}
