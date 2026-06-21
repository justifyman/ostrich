import { nip27 } from "nostr-tools";
const EVENT_ID = /^[0-9a-f]{64}$/i;
export function findQuotedEvents(event, limit = 3) {
    const pointers = new Map();
    const remember = (id, relays = []) => {
        if (!EVENT_ID.test(id) || id === event.id)
            return;
        const knownRelays = pointers.get(id) ?? new Set();
        for (const relay of relays) {
            if (relay.startsWith("wss://") || relay.startsWith("ws://")) {
                knownRelays.add(relay);
            }
        }
        pointers.set(id.toLowerCase(), knownRelays);
    };
    for (const [name, id, relay] of event.tags) {
        if (name === "q" && id) {
            remember(id, relay ? [relay] : []);
        }
    }
    for (const block of nip27.parse(event.content)) {
        if (block.type === "reference" &&
            "id" in block.pointer &&
            typeof block.pointer.id === "string") {
            remember(block.pointer.id, block.pointer.relays ?? []);
        }
    }
    return [...pointers.entries()].slice(0, limit).map(([id, relays]) => ({
        id,
        relays: [...relays],
    }));
}
export function formatQuotedNote(event) {
    return `[Referenced Nostr note by ${event.pubkey}]\n${event.content}\n[End referenced note]`;
}
