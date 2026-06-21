import { finalizeEvent, nip10, verifyEvent, } from "nostr-tools";
import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import WebSocket from "ws";
import { findQuotedEvents, formatQuotedNote } from "./quoted-notes.js";
useWebSocketImplementation(WebSocket);
export class NostrClient {
    relays;
    privateKey;
    publicKey;
    pool = new SimplePool();
    constructor(relays, privateKey, publicKey) {
        this.relays = relays;
        this.privateKey = privateKey;
        this.publicKey = publicKey;
    }
    listen(onEvent) {
        const filter = {
            kinds: [1],
            "#p": [this.publicKey],
            since: Math.floor(Date.now() / 1_000) - 10,
        };
        return this.pool.subscribeMany(this.relays, filter, {
            onevent: (event) => {
                if (verifyEvent(event))
                    onEvent(event);
            },
        });
    }
    async buildConversation(event, maxEvents) {
        const chain = [event];
        const visited = new Set([event.id]);
        let cursor = event;
        while (chain.length < maxEvents) {
            const parentId = nip10.parse(cursor).reply?.id ?? nip10.parse(cursor).root?.id;
            if (!parentId || visited.has(parentId))
                break;
            const parent = await this.pool.get(this.relays, { ids: [parentId] });
            if (!parent || !verifyEvent(parent))
                break;
            chain.push(parent);
            visited.add(parent.id);
            cursor = parent;
        }
        const chronologicalChain = chain.reverse();
        const messages = chronologicalChain.map((note) => ({
            role: note.pubkey === this.publicKey ? "assistant" : "user",
            content: note.content,
        }));
        const chainIds = new Set(chronologicalChain.map((note) => note.id));
        const quotedPointers = findQuotedEvents(event).filter((pointer) => !chainIds.has(pointer.id));
        const quotedNotes = await Promise.all(quotedPointers.map(async (pointer) => {
            const lookupRelays = [...new Set([...pointer.relays, ...this.relays])];
            const quoted = await this.pool.get(lookupRelays, { ids: [pointer.id] });
            return quoted && verifyEvent(quoted) ? quoted : null;
        }));
        const quotedMessages = quotedNotes.flatMap((note) => note
            ? [
                {
                    role: "user",
                    content: formatQuotedNote(note),
                },
            ]
            : []);
        if (quotedMessages.length === 0)
            return messages;
        const triggeringMessage = messages.pop();
        return triggeringMessage
            ? [...messages, ...quotedMessages, triggeringMessage]
            : quotedMessages;
    }
    async publishReply(target, content) {
        const references = nip10.parse(target);
        const rootId = references.root?.id ?? target.id;
        const tags = [
            ["e", rootId, "", "root"],
            ["e", target.id, "", "reply"],
            ["p", target.pubkey],
        ];
        const event = finalizeEvent({
            kind: 1,
            created_at: Math.floor(Date.now() / 1_000),
            tags,
            content,
        }, this.privateKey);
        await Promise.any(this.pool.publish(this.relays, event));
        return event;
    }
    close() {
        this.pool.close(this.relays);
    }
}
