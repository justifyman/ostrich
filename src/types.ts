import type { Event } from "nostr-tools";

export type NostrEvent = Event;

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  parentExpected: boolean;
  parentLoaded: boolean;
}
