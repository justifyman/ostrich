import { nip19, nip27 } from "nostr-tools";
import type { NostrEvent } from "./types.js";

export function isAddressedToBot(event: NostrEvent, botPublicKey: string): boolean {
  if ((event.kind !== 1 && event.kind !== 1111) || event.pubkey === botPublicKey) {
    return false;
  }

  if (event.tags.some(([name, value]) => name === "p" && value === botPublicKey)) {
    return true;
  }

  for (const block of nip27.parse(event.content)) {
    if (
      block.type === "reference" &&
      "pubkey" in block.pointer &&
      block.pointer.pubkey === botPublicKey
    ) {
      return true;
    }
  }

  const botNpub = nip19.npubEncode(botPublicKey);
  return event.content.includes(botNpub);
}
