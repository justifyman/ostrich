export interface RateLimitPermit {
  release: () => void;
}

export type RateLimitResult =
  | { allowed: true; permit: RateLimitPermit }
  | { allowed: false; retryAfterMs: number; reason: "window" | "concurrency" };

export class GlobalRateLimiter {
  private readonly requestTimes: number[] = [];
  private inFlight = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly maxConcurrent: number,
  ) {}

  tryAcquire(now = Date.now()): RateLimitResult {
    this.prune(now);

    if (this.inFlight >= this.maxConcurrent) {
      return {
        allowed: false,
        retryAfterMs: 1_000,
        reason: "concurrency",
      };
    }

    if (this.requestTimes.length >= this.maxRequests) {
      const oldest = this.requestTimes[0] ?? now;
      return {
        allowed: false,
        retryAfterMs: Math.max(1, oldest + this.windowMs - now),
        reason: "window",
      };
    }

    this.requestTimes.push(now);
    this.inFlight += 1;
    let released = false;

    return {
      allowed: true,
      permit: {
        release: () => {
          if (released) return;
          released = true;
          this.inFlight = Math.max(0, this.inFlight - 1);
        },
      },
    };
  }

  async acquire(): Promise<RateLimitPermit> {
    while (true) {
      const result = this.tryAcquire();
      if (result.allowed) return result.permit;
      await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs));
    }
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while ((this.requestTimes[0] ?? Number.POSITIVE_INFINITY) <= cutoff) {
      this.requestTimes.shift();
    }
  }
}
