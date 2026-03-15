# creem-datafast-integration

TypeScript package that automatically connects [CREEM](https://creem.io) payments to [DataFast](https://datafa.st) analytics for revenue attribution. Merchants can attribute revenue to traffic sources without writing any glue code.

[![CI](https://github.com/samolubukun/Creem-DataFast-Integration/actions/workflows/ci.yml/badge.svg)](https://github.com/samolubukun/Creem-DataFast-Integration/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/creem-datafast-integration.svg)](https://www.npmjs.com/package/creem-datafast-integration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Zero glue code** — one factory call wires up checkout attribution and webhook forwarding
- **Edge-runtime ready** — uses the Web Crypto API (`SubtleCrypto`); works in Cloudflare Workers, Bun, Deno, and Node.js 18+
- **Framework adapters** — Next.js App Router, Express, and a generic handler for Hono/Fastify/Koa/CF Workers
- **Custom SDK injection** — pass a pre-configured `Creem` instance instead of an API key
- **Standalone signature verification** — `verifyWebhookSignature()` for custom middleware flows
- **URL query-param fallback** — `getVisitorIdFromUrl()` / `getVisitorIdWithFallback()` for SSR and email deep-links
- **Production-ready** — idempotent webhooks, retries with backoff, HMAC-SHA256 signature verification
- **Refund support** — forwards `refund.created` as `refunded: true` payment events
- **Currency-aware** — correctly converts zero-decimal (JPY, KRW) and three-decimal (KWD, BHD) currencies
- **Session tracking** — captures both `datafast_visitor_id` and `datafast_session_id`
- **Strict tracking mode** — optionally throw errors when visitor ID is missing
- **Distributed idempotency** — Upstash Redis adapter for serverless/multi-instance deployments
- **Configurable** — timeout, retry logic, custom logger
- **TypeScript first** — full type definitions included
- **AI-ready** — `SKILL.md` for Claude/Cursor/Copilot auto-integration

## Installation

```bash
npm install creem-datafast-integration
```

Optional (for distributed idempotency):
```bash
npm install @upstash/redis
```

## Quick Start

### Next.js

```typescript
// app/api/checkout/route.ts
import { createCreemDataFastClient } from 'creem-datafast-integration';
import { cookies } from 'next/headers';

const client = createCreemDataFastClient({ apiKey: process.env.CREEM_API_KEY! });

export async function POST() {
  const cookieStore = await cookies();
  const cookieObj = Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value]));

  const { checkoutUrl } = await client.createCheckout(
    { productId: process.env.CREEM_PRODUCT_ID! },
    cookieObj
  );

  return Response.redirect(checkoutUrl, 303);
}
```

```typescript
// app/api/webhooks/creem/route.ts
import { createNextJsWebhookHandler } from 'creem-datafast-integration/nextjs';

export const POST = createNextJsWebhookHandler({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
});
```

### Express

```typescript
import express from 'express';
import { createCreemDataFastClient, creemDataFastWebhook } from 'creem-datafast-integration';

const app = express();
const client = createCreemDataFastClient({ apiKey: process.env.CREEM_API_KEY! });

app.post('/api/checkout', async (req, res) => {
  const { checkoutUrl } = await client.createCheckout(
    { productId: process.env.CREEM_PRODUCT_ID! },
    req.cookies
  );
  res.redirect(303, checkoutUrl);
});

app.post(
  '/api/webhook/creem',
  express.raw({ type: 'application/json' }),
  creemDataFastWebhook({
    creemApiKey: process.env.CREEM_API_KEY!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  })
);
```

### Cloudflare Workers / Hono / Bun / Deno

```typescript
import { handleGenericWebhook } from 'creem-datafast-integration/server';

// Works in any framework — Hono, Fastify, Koa, raw CF Workers fetch handler…
app.post('/webhooks/creem', async (c) => {
  const result = await handleGenericWebhook({
    creemApiKey: process.env.CREEM_API_KEY!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
    getRawBody: () => c.req.text(),
    getHeaders: () => Object.fromEntries(c.req.raw.headers),
  });
  return c.json(result, result.success ? 200 : 400);
});
```

### Client-Side

```typescript
import {
  DataFastClient,
  getVisitorIdFromUrl,
  getVisitorIdWithFallback,
} from 'creem-datafast-integration/client';

// From cookies (browser)
const visitorId = DataFastClient.getVisitorId();

// From URL query params (SSR / email deep-links)
const idFromUrl = getVisitorIdFromUrl('https://example.com/?datafast_visitor_id=abc');

// Cookies first, then URL fallback
const id = getVisitorIdWithFallback();
```

## Advanced

### Inject a Pre-Configured Creem SDK Instance

```typescript
import { Creem } from 'creem';
import { createCreemDataFastClient } from 'creem-datafast-integration';

const creemSdk = new Creem({ apiKey: process.env.CREEM_API_KEY! });

// Share a single SDK instance across your app
const client = createCreemDataFastClient({ apiKey: '', creemClient: creemSdk });
```

### Standalone Signature Verification (Edge-Compatible)

```typescript
import { verifyWebhookSignature, InvalidCreemSignatureError } from 'creem-datafast-integration';

// Uses SubtleCrypto — works in Cloudflare Workers, Bun, Deno, Node.js 18+
try {
  await verifyWebhookSignature(rawBody, signature, process.env.CREEM_WEBHOOK_SECRET!);
} catch (e) {
  if (e instanceof InvalidCreemSignatureError) {
    return new Response('Unauthorized', { status: 401 });
  }
  throw e;
}
```

### Strict Tracking Mode

```typescript
const client = createCreemDataFastClient({
  apiKey: process.env.CREEM_API_KEY!,
  strictTracking: true, // throws MissingTrackingError if no visitor ID
});
```

### Idempotency (Production Multi-Instance)

```bash
npm install @upstash/redis
```

```typescript
import { createUpstashIdempotencyStore } from 'creem-datafast-integration/idempotency/upstash';

createWebhookHandler({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  idempotencyStore: createUpstashIdempotencyStore({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    ttlSeconds: 86400,
  }),
});
```

### Retry with Exponential Backoff

```typescript
createWebhookHandler({
  // ...
  retry: { retries: 3, baseDelayMs: 500, maxDelayMs: 5000 },
});
```

### Custom Logger

```typescript
createWebhookHandler({
  // ...
  logger: {
    info:  (msg, meta) => myLogger.info(msg, meta),
    warn:  (msg, meta) => myLogger.warn(msg, meta),
    error: (msg, meta) => myLogger.error(msg, meta),
  },
});
```

### Error Handling

```typescript
import {
  CreemDataFastError,        // base class
  InvalidCreemSignatureError, // webhook sig mismatch
  MissingTrackingError,       // strictTracking: true and no visitor ID
  DataFastRequestError,       // DataFast HTTP error (.status, .retryable)
} from 'creem-datafast-integration';

try {
  // ...
} catch (error) {
  if (error instanceof DataFastRequestError) {
    console.error('DataFast error', error.status, error.retryable);
  }
}
```

## Supported Events

| CREEM event | DataFast forwarding |
|---|---|
| `checkout.completed` | One-time payment |
| `subscription.paid` | Recurring payment (`renewal: true`) |
| `refund.created` | Refund (`refund: true`, negative amount) |

## Currency Handling

| Type | Examples | Conversion |
|---|---|---|
| Standard (2 decimal) | USD, EUR, GBP | `amount / 100` |
| Zero-decimal | JPY, KRW, VND, IDR, CLP, ISK | `amount` (unchanged) |
| Three-decimal | KWD, BHD, OMR, TND, JOD, IQD | `amount / 1000` |

## AI Agent Integration

Copy [`SKILL.md`](./SKILL.md) into Claude, Cursor, Copilot, or any AI coding assistant to give it full integration context.

## License

[MIT](LICENSE)
