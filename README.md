# Token Meter

Track LLM token usage and cost across providers via a **proxy/gateway**. Users route
their Anthropic traffic through the proxy; every request's `usage` is captured, priced,
and rendered in a dashboard. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design.

Stack: Next.js (App Router, TS) · Postgres + Drizzle · Tailwind · Recharts.

## Prerequisites

- Node 20+, pnpm
- Postgres running locally (e.g. `brew services start postgresql@17`)

## Setup

```bash
pnpm install
createdb llm_usage                 # or: psql -c 'create database llm_usage'
cp .env.example .env.local         # then fill in the values below
pnpm db:push                       # create tables
pnpm db:seed                       # seed Anthropic model pricing
pnpm dev                           # http://localhost:3000
```

`.env.local` values:

| Var | What |
|---|---|
| `DATABASE_URL` | `postgresql://<user>@localhost:5432/llm_usage` |
| `MASTER_ENCRYPTION_KEY` | base64 of 32 random bytes — encrypts provider keys at rest (swap for KMS in prod) |
| `SESSION_SECRET` | base64 of 32 random bytes — signs session cookies |
| `ANTHROPIC_BASE_URL` | upstream (`https://api.anthropic.com`) |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## Using it

1. Sign up at `/signup`.
2. Under **Keys**, add your Anthropic key (stored AES-256-GCM encrypted; only the last 4 shown).
3. Issue a **proxy key** (shown once). Point your SDK at the proxy:

```ts
const client = new Anthropic({
  baseURL: "http://localhost:3000",      // the proxy ORIGIN — the SDK appends /v1/messages itself
  apiKey: process.env.LLMUSAGE_PROXY_KEY, // your proxy key, NOT your Anthropic key
});
```

> ⚠️ For the official Anthropic SDK, `baseURL` is the **origin** (no `/v1`) — the SDK adds `/v1/messages`.
> For raw `curl` you hit the full path yourself: `http://localhost:3000/v1/messages`.

4. Make requests as usual (streaming and non-streaming both work). Usage + cost land on the **Overview** dashboard.
