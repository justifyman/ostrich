import assert from "node:assert/strict";
import test from "node:test";
import { GlobalRateLimiter } from "../src/rate-limiter.js";

test("blocks requests after the global window limit", () => {
  const limiter = new GlobalRateLimiter(2, 1_000, 5);
  const first = limiter.tryAcquire(0);
  const second = limiter.tryAcquire(100);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  if (first.allowed) first.permit.release();
  if (second.allowed) second.permit.release();

  const blocked = limiter.tryAcquire(200);
  assert.deepEqual(blocked, {
    allowed: false,
    retryAfterMs: 800,
    reason: "window",
  });

  assert.equal(limiter.tryAcquire(1_000).allowed, true);
});

test("limits concurrent work and releases permits safely", () => {
  const limiter = new GlobalRateLimiter(10, 1_000, 1);
  const first = limiter.tryAcquire(0);
  assert.equal(first.allowed, true);

  assert.deepEqual(limiter.tryAcquire(1), {
    allowed: false,
    retryAfterMs: 1_000,
    reason: "concurrency",
  });

  if (first.allowed) {
    first.permit.release();
    first.permit.release();
  }

  assert.equal(limiter.tryAcquire(2).allowed, true);
});
