import { nip19 } from "nostr-tools";
import type { Config } from "./config.js";
import { limitConversation } from "./context.js";
import { GroqResponder } from "./groq.js";
import { logger } from "./logger.js";
import { isAddressedToBot } from "./mentions.js";
import { NostrClient } from "./nostr.js";
import { GlobalRateLimiter } from "./rate-limiter.js";
import type { NostrEvent } from "./types.js";

export class OstrichBot {
  private readonly nostr: NostrClient;
  private readonly groq: GroqResponder;
  private readonly seen = new Set<string>();
  private readonly authorLastReply = new Map<string, number>();
  private subscription?: { close: (reason?: string) => void };
  private readonly npub: string;
  private readonly globalLimiter: GlobalRateLimiter;

  constructor(private readonly config: Config) {
    this.npub = nip19.npubEncode(config.publicKey);
    this.globalLimiter = new GlobalRateLimiter(
      config.globalMaxRequests,
      config.globalRateWindowMs,
      config.maxConcurrentRequests,
    );
    this.nostr = new NostrClient(config.relays, config.privateKey, config.publicKey);
    this.groq = new GroqResponder({
      apiKey: config.groqApiKey,
      model: config.groqModel,
      maxTokens: config.maxReplyTokens,
      temperature: config.temperature,
      npub: this.npub,
    });
  }

  start(): void {
    this.subscription = this.nostr.listen((event) => {
      void this.handleEvent(event);
    });

    logger.info("ostrich is awake", {
      npub: this.npub,
      relays: this.config.relays.length,
      model: this.config.groqModel,
      globalLimit: `${this.config.globalMaxRequests}/${this.config.globalRateWindowMs / 1_000}s`,
      maxConcurrent: this.config.maxConcurrentRequests,
    });
  }

  stop(): void {
    this.subscription?.close("ostrich shutting down");
    this.nostr.close();
    logger.info("ostrich tucked its head into the sand");
  }

  private async handleEvent(event: NostrEvent): Promise<void> {
    if (this.seen.has(event.id) || !isAddressedToBot(event, this.config.publicKey)) {
      return;
    }
    this.remember(event.id);

    const now = Date.now();
    const lastReply = this.authorLastReply.get(event.pubkey) ?? 0;
    if (now - lastReply < this.config.authorCooldownMs) {
      logger.warn("author is on cooldown", { eventId: event.id, author: event.pubkey });
      return;
    }
    this.authorLastReply.set(event.pubkey, now);

    if (event.content.length > this.config.maxInputChars) {
      try {
        await this.nostr.publishReply(
          event,
          `that note is a bit too large for my tiny bird brain. keep it under ${this.config.maxInputChars.toLocaleString()} characters and try again.`,
        );
        logger.warn("rejected oversized note", {
          eventId: event.id,
          characters: event.content.length,
        });
      } catch (error) {
        logger.error("failed to reject oversized note", {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    const rateLimit = this.globalLimiter.tryAcquire();
    if (!rateLimit.allowed) {
      logger.warn("global rate limit reached", {
        eventId: event.id,
        reason: rateLimit.reason,
        retryAfterMs: rateLimit.retryAfterMs,
      });
      return;
    }

    try {
      logger.info("answering note", { eventId: event.id, author: event.pubkey });
      const rawConversation = await this.nostr.buildConversation(
        event,
        this.config.contextEvents,
      );
      const conversation = limitConversation(
        rawConversation,
        this.config.maxInputChars,
        this.config.maxContextChars,
      );
      const response = await this.groq.reply(conversation);
      const reply = await this.nostr.publishReply(event, response);
      logger.info("reply published", { eventId: reply.id, parentId: event.id });
    } catch (error) {
      logger.error("failed to answer note", {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      rateLimit.permit.release();
    }
  }

  private remember(eventId: string): void {
    this.seen.add(eventId);
    if (this.seen.size <= 10_000) return;

    const oldest = this.seen.values().next().value;
    if (oldest) this.seen.delete(oldest);
  }
}
