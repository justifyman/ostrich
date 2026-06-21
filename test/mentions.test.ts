import assert from "node:assert/strict";
import test from "node:test";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { isAddressedToBot } from "../src/mentions.js";
import type { NostrEvent } from "../src/types.js";

const botPublicKey = getPublicKey(generateSecretKey());
const authorPublicKey = getPublicKey(generateSecretKey());

function note(content: string, tags: string[][] = []): NostrEvent {
  return {
    id: "a".repeat(64),
    pubkey: authorPublicKey,
    created_at: 1,
    kind: 1,
    tags,
    content,
    sig: "b".repeat(128),
  };
}

test("detects a p-tag mention", () => {
  assert.equal(isAddressedToBot(note("yo", [["p", botPublicKey]]), botPublicKey), true);
});

test("detects an npub mention in content", () => {
  assert.equal(
    isAddressedToBot(note(`hey nostr:${nip19.npubEncode(botPublicKey)}`), botPublicKey),
    true,
  );
});

test("ignores unrelated notes and the bot's own notes", () => {
  assert.equal(isAddressedToBot(note("just posting"), botPublicKey), false);
  assert.equal(
    isAddressedToBot({ ...note("echo"), pubkey: botPublicKey }, botPublicKey),
    false,
  );
});
