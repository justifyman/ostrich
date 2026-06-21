# Contributing to Ostrich

Thanks for helping the bird become smarter without making it unbearable.

## Development setup

1. Fork and clone the repository.
2. Install Node.js 20 or newer.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and use dedicated development credentials.
5. Run `npm run check` and `npm test` before opening a pull request.

Use `npm run dev` for local development. Keep changes focused and add tests for behavior that can be tested without live relays or paid API calls.

## Pull requests

- Explain what changed and why.
- Keep modules small and avoid mixing relay, model, and orchestration concerns.
- Preserve compatibility with environment-based configuration.
- Never include real keys, copied `.env` files, or private note content.
- Update the README when adding configuration or changing setup.
- Prefer standards-based Nostr behavior and link the relevant NIP when appropriate.

## Good first contributions

- Persistent event deduplication
- Better thread participant labeling
- NIP-42 relay authentication
- NIP-46 remote signing
- Configurable allowlists or blocklists
- Metrics and health checks
- Docker and deployment examples
- More unit tests around NIP-10 reply tags

## Reporting security issues

Do not open a public issue containing credentials or an exploitable secret-handling bug. Contact the maintainers privately and rotate any credential that may have been exposed.
