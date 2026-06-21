import Groq from "groq-sdk";
import { buildOstrichSystemPrompt } from "./system-prompt.js";
export class GroqResponder {
    options;
    client;
    constructor(options) {
        this.options = options;
        this.client = new Groq({ apiKey: options.apiKey });
    }
    async reply(messages) {
        const completion = await this.client.chat.completions.create({
            model: this.options.model,
            temperature: this.options.temperature,
            max_completion_tokens: this.options.maxTokens,
            messages: [
                { role: "system", content: buildOstrichSystemPrompt(this.options.npub) },
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
