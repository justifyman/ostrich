import "dotenv/config";
import { getPublicKey, nip19 } from "nostr-tools";
function required(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function integer(name, fallback, min, max) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max}`);
    }
    return value;
}
function number(name, fallback, min, max) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${name} must be a number between ${min} and ${max}`);
    }
    return value;
}
function decodePrivateKey(value) {
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
    return Uint8Array.from(value.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)));
}
function parseRelays(value) {
    const relays = [...new Set(value.split(",").map((relay) => relay.trim()).filter(Boolean))];
    if (relays.length === 0) {
        throw new Error("NOSTR_RELAYS must contain at least one relay");
    }
    for (const relay of relays) {
        const url = new URL(relay);
        if (url.protocol !== "wss:" && url.protocol !== "ws:") {
            throw new Error(`Relay must use ws:// or wss://: ${relay}`);
        }
    }
    return relays;
}
export function loadConfig() {
    const privateKey = decodePrivateKey(required("NOSTR_PRIVATE_KEY"));
    return {
        groqApiKey: required("GROQ_API_KEY"),
        groqModel: process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b",
        privateKey,
        publicKey: getPublicKey(privateKey),
        relays: parseRelays(process.env.NOSTR_RELAYS ||
            "wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net"),
        maxReplyTokens: integer("MAX_REPLY_TOKENS", 220, 32, 2_048),
        temperature: number("TEMPERATURE", 0.8, 0, 2),
        contextEvents: integer("CONTEXT_EVENTS", 8, 1, 30),
        maxInputChars: integer("MAX_INPUT_CHARS", 2_000, 100, 20_000),
        maxContextChars: integer("MAX_CONTEXT_CHARS", 8_000, 500, 100_000),
        authorCooldownMs: integer("AUTHOR_COOLDOWN_SECONDS", 15, 0, 3_600) * 1_000,
        globalMaxRequests: integer("GLOBAL_MAX_REQUESTS", 30, 1, 10_000),
        globalRateWindowMs: integer("GLOBAL_RATE_WINDOW_SECONDS", 60, 1, 86_400) * 1_000,
        maxConcurrentRequests: integer("MAX_CONCURRENT_REQUESTS", 2, 1, 100),
    };
}
