import Groq from "groq-sdk";
import { buildOstrichSystemPrompt } from "./system-prompt.js";
import type { ConversationMessage } from "./types.js";

export interface GroqResponderOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  npub: string;
  sourceCodeUrl?: string;
}

export class GroqResponder {
  private readonly client: Groq;

  constructor(private readonly options: GroqResponderOptions) {
    this.client = new Groq({ apiKey: options.apiKey });
  }

  async reply(messages: ConversationMessage[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.options.model,
      temperature: this.options.temperature,
      max_completion_tokens: this.options.maxTokens,
      messages: [
        {
          role: "system",
          content: buildOstrichSystemPrompt(
            this.options.npub,
            this.options.sourceCodeUrl,
          ),
        },
        ...messages,
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Groq returned an empty response");
    }
    return content;
  }
}
