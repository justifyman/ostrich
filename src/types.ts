import type { Event } from "nostr-tools";

export type NostrEvent = Event;

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}
