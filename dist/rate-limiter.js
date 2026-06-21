export class GlobalRateLimiter {
    maxRequests;
    windowMs;
    maxConcurrent;
    requestTimes = [];
    inFlight = 0;
    constructor(maxRequests, windowMs, maxConcurrent) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.maxConcurrent = maxConcurrent;
    }
    tryAcquire(now = Date.now()) {
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
                    if (released)
                        return;
                    released = true;
                    this.inFlight = Math.max(0, this.inFlight - 1);
                },
            },
        };
    }
    prune(now) {
        const cutoff = now - this.windowMs;
        while ((this.requestTimes[0] ?? Number.POSITIVE_INFINITY) <= cutoff) {
            this.requestTimes.shift();
        }
    }
}
