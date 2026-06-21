import assert from "node:assert/strict";
import test from "node:test";
import { limitConversation } from "../src/context.js";

test("keeps the newest messages within the total context budget", () => {
  const result = limitConversation(
    [
      { role: "user", content: "oldest" },
      { role: "assistant", content: "middle" },
      { role: "user", content: "newest" },
    ],
    100,
    12,
  );

  assert.deepEqual(result, [
    { role: "assistant", content: "middle" },
    { role: "user", content: "newest" },
  ]);
});

test("clips an individual message", () => {
  const [message] = limitConversation(
    [{ role: "user", content: "x".repeat(100) }],
    40,
    100,
  );

  assert.equal(message?.content.length, 40);
  assert.match(message?.content ?? "", /\[earlier note clipped\]$/);
});
