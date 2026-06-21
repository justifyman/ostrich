import assert from "node:assert/strict";
import test from "node:test";
import { withRetry } from "../src/retry.js";

test("retries transient failures and returns the successful value", async () => {
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary");
      return "ok";
    },
    {
      attempts: 3,
      initialDelayMs: 1,
      operationName: "test",
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("throws after all retry attempts fail", async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error("still broken");
      },
      {
        attempts: 2,
        initialDelayMs: 1,
        operationName: "test",
      },
    ),
    /still broken/,
  );

  assert.equal(attempts, 2);
});
