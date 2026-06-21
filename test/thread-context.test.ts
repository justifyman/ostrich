import assert from "node:assert/strict";
import test from "node:test";
import {
  formatThreadMessages,
  getParentPointer,
  getRelayHints,
} from "../src/thread-context.js";
import type { NostrEvent } from "../src/types.js";

function note(id: string, content: string, tags: string[][] = []): NostrEvent {
  return {
    id,
    pubkey: "c".repeat(64),
    created_at: 1,
    kind: 1,
    tags,
    content,
    sig: "d".repeat(128),
  };
}

test("uses a marked reply pointer and preserves its relay hint", () => {
  const parentId = "b".repeat(64);
  const event = note("a".repeat(64), "what does this say?", [
    ["e", "f".repeat(64), "wss://root.example", "root"],
    ["e", parentId, "wss://parent.example", "reply"],
  ]);

  const pointer = getParentPointer(event);
  assert.equal(pointer?.id, parentId);
  assert.deepEqual(getRelayHints(event, pointer), [
    "wss://parent.example",
    "wss://root.example",
  ]);
});

test("supports legacy unmarked reply tags", () => {
  const parentId = "b".repeat(64);
  const pointer = getParentPointer(
    note("a".repeat(64), "legacy reply", [
      ["e", "f".repeat(64), "wss://root.example"],
      ["e", parentId, "wss://parent.example"],
    ]),
  );

  assert.equal(pointer?.id, parentId);
});

test("uses the lowercase e tag as a NIP-22 parent", () => {
  const parentId = "b".repeat(64);
  const pointer = getParentPointer({
    ...note("a".repeat(64), "comment", [
      ["E", "f".repeat(64), "wss://root.example"],
      ["e", parentId, "wss://parent.example", "c".repeat(64)],
      ["k", "1111"],
    ]),
    kind: 1111,
  });

  assert.deepEqual(pointer, {
    id: parentId,
    relays: ["wss://parent.example"],
    author: "c".repeat(64),
  });
});

test("labels the parent note and current request clearly", () => {
  const messages = formatThreadMessages(
    [
      note("b".repeat(64), "Bitcoin uses proof of work."),
      note("a".repeat(64), "what does this note mean?"),
    ],
    "e".repeat(64),
  );

  assert.match(messages[0]?.content ?? "", /Parent note being replied to/);
  assert.match(messages[0]?.content ?? "", /Bitcoin uses proof of work/);
  assert.match(messages[1]?.content ?? "", /Current request/);
});
