import "dotenv/config";
import { getPublicKey, nip19 } from "nostr-tools";

export interface Config {
  groqApiKey: string;
  groqModel: string;
  sourceCodeUrl?: string;
  privateKey: Uint8Array;
  publicKey: string;
  relays: string[];
  maxReplyTokens: number;
  temperature: number;
  contextEvents: number;
  maxInputChars: number;
  maxContextChars: number;
  authorCooldownMs: number;
  globalMaxRequests: number;
  globalRateWindowMs: number;
  maxConcurrentRequests: number;
  maxQueueSize: number;
  retryAttempts: number;
  retryDelayMs: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function number(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
}

function decodePrivateKey(value: string): Uint8Array {
  if (value.startsWith("nsec1")) {
    const decoded = nip19.decode(value);
    if (decoded.type !== "nsec") {
      throw new Error("NOSTR_PRIVATE_KEY is not a valid nsec");
    }
    return decoded.data;
  }

  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("NOSTR_PRIVATE_KEY must be an nsec or 64-character hex key");
  }

  return Uint8Array.from(value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

function parseRelays(value: string): string[] {
  const relays = [...new Set(value.split(",").map((relay) => relay.trim()).filter(Boolean))];
  if (relays.length === 0) {
    throw new Error("NOSTR_RELAYS must contain at least one relay");
  }

  for (const relay of relays) {
    const url = new URL(relay);
    if (url.protocol !== "wss:" && url.protocol !== "ws:") {
      throw new Error(`Relay must use ws:// or wss://: ${relay}`);
    }
    if (relay.includes("|") || url.username || url.password || url.hash) {
      throw new Error(`Relay URL contains unsupported characters or credentials: ${relay}`);
    }
  }
  return relays;
}

function parseSourceCodeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const url = new URL(trimmed);
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new Error("SOURCE_CODE_URL must be an https://github.com URL");
  }
  return url.toString().replace(/\/$/, "");
}

export function loadConfig(): Config {
  const privateKey = decodePrivateKey(required("NOSTR_PRIVATE_KEY"));

  return {
    groqApiKey: required("GROQ_API_KEY"),
    groqModel: process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b",
    sourceCodeUrl: parseSourceCodeUrl(process.env.SOURCE_CODE_URL),
    privateKey,
    publicKey: getPublicKey(privateKey),
    relays: parseRelays(
      process.env.NOSTR_RELAYS ||
        "wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net",
    ),
    maxReplyTokens: integer("MAX_REPLY_TOKENS", 220, 32, 2_048),
    temperature: number("TEMPERATURE", 0.8, 0, 2),
    contextEvents: integer("CONTEXT_EVENTS", 8, 1, 30),
    maxInputChars: integer("MAX_INPUT_CHARS", 2_000, 100, 20_000),
    maxContextChars: integer("MAX_CONTEXT_CHARS", 8_000, 500, 100_000),
    authorCooldownMs: integer("AUTHOR_COOLDOWN_SECONDS", 15, 0, 3_600) * 1_000,
    globalMaxRequests: integer("GLOBAL_MAX_REQUESTS", 30, 1, 10_000),
    globalRateWindowMs:
      integer("GLOBAL_RATE_WINDOW_SECONDS", 60, 1, 86_400) * 1_000,
    maxConcurrentRequests: integer("MAX_CONCURRENT_REQUESTS", 2, 1, 100),
    maxQueueSize: integer("MAX_QUEUE_SIZE", 100, 1, 10_000),
    retryAttempts: integer("RETRY_ATTEMPTS", 3, 1, 10),
    retryDelayMs: integer("RETRY_DELAY_MS", 750, 100, 60_000),
  };
}
