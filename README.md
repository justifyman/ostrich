# Ostrich

Ostrich is an open-source AI bot that lives on Nostr. It watches for mentions and replies, reads the surrounding thread, asks Groq for a fast response, and publishes a signed Nostr reply.

It aims for useful, concise answers with just enough chaos to feel native.

## Features

- Connects to multiple Nostr relays
- Listens for kind-1 notes tagged with the bot's public key
- Recognizes NIP-27 `npub`/`nprofile` mentions
- Rebuilds NIP-10 reply context before answering
- Supports NIP-22 `kind:1111` comments and comment replies
- Uses reply-tag relay hints and retries to recover parent notes across relays
- Reads quoted notes from NIP-18 `q` tags and `nostr:note1...`/`nostr:nevent1...` links
- Uses Groq chat completions
- Signs replies locally with a dedicated Nostr key
- Deduplicates events received from several relays
- Includes per-author cooldowns and bounded conversation context
- Enforces a global request window and concurrency cap
- Queues bursts instead of silently dropping them
- Retries transient Groq and relay publish failures
- Logs relay connection and subscription failures
- Rejects oversized prompts before they consume model quota
- Treats public thread content as untrusted input
- Keeps secrets in environment variables and out of logs

## Requirements

- Node.js 20 or newer
- A [Groq API key](https://console.groq.com/keys)
- A dedicated Nostr private key for the bot

Do not use your personal Nostr key. Generate a separate identity for Ostrich and fund it with exactly zero regrettable secrets.

## Installation

```bash
git clone https://github.com/justifyman/ostrich.git
cd ostrich
npm install
cp exampleenv.txt .env
```

On Windows PowerShell, use:

```powershell
Copy-Item exampleenv.txt .env
```

Edit `.env` with your Groq API key and the bot's Nostr private key:

```dotenv
GROQ_API_KEY=gsk_your_key
NOSTR_PRIVATE_KEY=nsec1your_dedicated_bot_key
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net
GROQ_MODEL=openai/gpt-oss-20b
SOURCE_CODE_URL=https://github.com/justifyman/ostrich
```

`NOSTR_PRIVATE_KEY` accepts an `nsec` or a 64-character hex secret key. The file is ignored by Git, but you should still treat it like a live credential.

Ostrich uses `SOURCE_CODE_URL` to link people to its source code whenever they ask for its GitHub page or repository.

## Run Ostrich

Development mode with automatic reload:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Run the checks:

```bash
npm run check
npm test
```

At startup, Ostrich logs its `npub`, relay count, and Groq model. Mention that `npub` from a Nostr client and the bot should reply.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Yes | — | Groq API credential |
| `NOSTR_PRIVATE_KEY` | Yes | — | Dedicated bot `nsec` or hex key |
| `NOSTR_RELAYS` | No | Three public relays | Comma-separated relay URLs |
| `GROQ_MODEL` | No | `openai/gpt-oss-20b` | Groq chat model |
| `SOURCE_CODE_URL` | No | — | Public GitHub repository Ostrich shares when asked for its source |
| `MAX_REPLY_TOKENS` | No | `220` | Maximum generated tokens |
| `TEMPERATURE` | No | `0.8` | Response creativity |
| `CONTEXT_EVENTS` | No | `8` | Maximum notes loaded from a thread |
| `MAX_INPUT_CHARS` | No | `2000` | Maximum characters accepted in a triggering note |
| `MAX_CONTEXT_CHARS` | No | `8000` | Total character budget sent from the thread |
| `AUTHOR_COOLDOWN_SECONDS` | No | `15` | Minimum time between replies to one author |
| `GLOBAL_MAX_REQUESTS` | No | `30` | Maximum accepted AI requests per global window |
| `GLOBAL_RATE_WINDOW_SECONDS` | No | `60` | Length of the global rate-limit window |
| `MAX_CONCURRENT_REQUESTS` | No | `2` | Maximum AI requests processed simultaneously |
| `MAX_QUEUE_SIZE` | No | `100` | Maximum mentions waiting to be processed |
| `RETRY_ATTEMPTS` | No | `3` | Attempts for Groq responses and relay publishing |
| `RETRY_DELAY_MS` | No | `750` | Initial retry delay with exponential backoff |

Model availability can vary by Groq account. Set `GROQ_MODEL` to a chat-completion model currently available to you.

## How it works

1. `NostrClient` subscribes to kind-1 events with a `p` tag matching Ostrich.
2. Mention detection rejects unrelated notes and anything authored by the bot.
3. The conversation loader follows NIP-10 reply references backward.
4. It resolves up to three quoted or linked notes, verifies them, and labels them as untrusted context.
5. Oversized notes and requests beyond the global limits are rejected before calling Groq.
6. Older context is clipped to configured limits.
7. `GroqResponder` sends the bounded context plus Ostrich's identity-aware system prompt to Groq.
8. Ostrich signs a kind-1 reply locally and publishes it to the configured relays.

The Groq API never receives the Nostr private key. The key is used only in-process to derive the public key and sign outgoing events.

## Project structure

```text
src/
  bot.ts             orchestration, cooldowns, and deduplication
  config.ts          environment validation and key decoding
  groq.ts            Groq chat-completion client
  index.ts           application entry point and shutdown handling
  logger.ts          small structured logger
  mentions.ts        mention/reply targeting checks
  nostr.ts           relay subscriptions, thread loading, and publishing
  quoted-notes.ts    quoted and linked note reference handling
  rate-limiter.ts    global request and concurrency limits
  system-prompt.ts   Ostrich's personality
  types.ts           shared TypeScript types
test/
  mentions.test.ts
```

## Security notes

- Never commit `.env`, an `nsec`, or a hex private key.
- Use a dedicated bot identity, not your personal Nostr identity.
- Keep production secrets in your host's secret manager.
- Logs include event IDs and public keys, but never note content, API keys, or private keys.
- Public Nostr notes sent to Ostrich are forwarded to Groq as conversation context.
- Prompt-injection defenses reduce casual jailbreaks, but no language model can be guaranteed jailbreak-proof.
- Global limits are in-memory and reset when the bot restarts.
- The queue is also in-memory; queued requests are lost if the process stops.
- Review dependency updates and rotate credentials if you suspect exposure.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development flow and ideas for extensions.

Useful future modules include relay authentication, persistent deduplication, image understanding, NIP-05 profiles, zap handling, moderation controls, allowlists, and remote signing with NIP-46.

## License

MIT
