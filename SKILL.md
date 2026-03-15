# creem-datafast-integration — AI Agent Skill

Paste this file into Claude, Cursor, Copilot, or any AI coding assistant to give it full context for integrating `creem-datafast-integration` into a project.

---

## What this package does

`creem-datafast-integration` is a TypeScript package that bridges **CREEM** (payment processor) and **DataFast** (revenue analytics). When a payment is completed via CREEM, the package forwards that payment event to DataFast so it is attributed to the correct visitor/session.

It works in **Node.js 18+**, **Cloudflare Workers**, **Bun**, and **Deno** (uses the Web Crypto API — no Node-specific dependencies in the hot path).

---

## Installation

```bash
npm install creem-datafast-integration
```

Optional peer dependencies:
- `express` — for the Express middleware
- `next` — for the Next.js helper
- `@upstash/redis` — for the Upstash idempotency store

---

## Environment variables you need

```
CREEM_API_KEY=creem_live_...
CREEM_WEBHOOK_SECRET=whsec_...
DATAFAST_API_KEY=df_...
```

---

## Key concepts

| Concept | What it is |
|---|---|
| `datafast_visitor_id` | Cookie/query-param set by DataFast's tracking script. Must be forwarded at checkout creation so DataFast can attribute the revenue. |
| `datafast_session_id` | Session-level granularity (optional, also set by DataFast). |
| Webhook forwarding | On `checkout.completed` / `subscription.paid` / `refund.created`, forward the event to DataFast's payments API. |
| Idempotency | Each webhook event is stored by ID to prevent double-counting on retries. |

---

## Server-side: Create a checkout (inject tracking IDs)

### Next.js (App Router)

```ts
// app/api/checkout/route.ts
import { createCreemDataFastClient } from 'creem-datafast-integration';
import { cookies } from 'next/headers';

const client = createCreemDataFastClient({ apiKey: process.env.CREEM_API_KEY! });

export async function POST(req: Request) {
  const cookieStore = await cookies();
  // Pass cookie object — the client extracts datafast_visitor_id automatically
  const cookieObj = Object.fromEntries(
    cookieStore.getAll().map(c => [c.name, c.value])
  );

  const { checkoutUrl } = await client.createCheckout(
    { productId: 'prod_...' },
    cookieObj
  );

  return Response.json({ checkoutUrl });
}
```

### Express

```ts
import { createCreemDataFastClient } from 'creem-datafast-integration';

const client = createCreemDataFastClient({ apiKey: process.env.CREEM_API_KEY! });

app.post('/checkout', async (req, res) => {
  const { checkoutUrl } = await client.createCheckout(
    { productId: 'prod_...' },
    req.cookies // or req.headers.cookie (string)
  );
  res.json({ checkoutUrl });
});
```

### Inject a pre-configured Creem SDK instance

```ts
import { Creem } from 'creem';
import { createCreemDataFastClient } from 'creem-datafast-integration';

const creemClient = new Creem({ apiKey: process.env.CREEM_API_KEY! });

// Pass it in — the package will not create a second instance
const client = createCreemDataFastClient({ apiKey: '', creemClient });
```

---

## Server-side: Handle webhooks

### Next.js (App Router)

```ts
// app/api/webhooks/creem/route.ts
import { createNextJsWebhookHandler } from 'creem-datafast-integration/nextjs';

const handler = createNextJsWebhookHandler({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
});

export const POST = handler;
```

### Express

```ts
import { creemDataFastWebhook } from 'creem-datafast-integration/express';
import express from 'express';

const app = express();

app.post(
  '/webhooks/creem',
  express.raw({ type: 'application/json' }),
  creemDataFastWebhook({
    creemApiKey: process.env.CREEM_API_KEY!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  })
);
```

### Cloudflare Workers / Hono / Bun / Deno (generic handler)

```ts
import { handleGenericWebhook } from 'creem-datafast-integration/server';

// Hono example
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

---

## Standalone signature verification (edge-compatible)

```ts
import { verifyWebhookSignature, InvalidCreemSignatureError } from 'creem-datafast-integration';

try {
  await verifyWebhookSignature(rawBody, signature, process.env.CREEM_WEBHOOK_SECRET!);
  // signature is valid — proceed
} catch (e) {
  if (e instanceof InvalidCreemSignatureError) {
    return new Response('Invalid signature', { status: 401 });
  }
  throw e;
}
```

Uses `SubtleCrypto` (Web Crypto API) — works in Cloudflare Workers, Bun, Deno, and Node.js 18+.

---

## Client-side: Read tracking IDs

```ts
import { DataFastClient } from 'creem-datafast-integration/client';

// From cookies (browser)
const visitorId = DataFastClient.getVisitorId();

// From URL query params (fallback for SSR / email deep-links)
import { getVisitorIdFromUrl, getVisitorIdWithFallback } from 'creem-datafast-integration/client';

const id = getVisitorIdFromUrl('https://example.com/success?datafast_visitor_id=abc');

// Cookies first, then URL params
const id2 = getVisitorIdWithFallback();
```

---

## Advanced options

### Retry with exponential backoff

```ts
createWebhookHandler({
  // ...
  retry: { retries: 3, baseDelayMs: 500, maxDelayMs: 5000 },
});
```

### Idempotency (Upstash Redis)

```ts
import { createUpstashIdempotencyStore } from 'creem-datafast-integration/idempotency/upstash';

createWebhookHandler({
  // ...
  idempotencyStore: createUpstashIdempotencyStore({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    ttlSeconds: 86400,
  }),
});
```

### Custom logger

```ts
createWebhookHandler({
  // ...
  logger: {
    debug: (msg, meta) => myLogger.debug(msg, meta),
    info: (msg, meta) => myLogger.info(msg, meta),
    warn: (msg, meta) => myLogger.warn(msg, meta),
    error: (msg, meta) => myLogger.error(msg, meta),
  },
});
```

### Strict tracking mode

```ts
// Throws MissingTrackingError if datafast_visitor_id is absent
createWebhookHandler({ ..., strictTracking: true });
createCreemDataFastClient({ ..., strictTracking: true });
```

---

## Error classes

```ts
import {
  CreemDataFastError,        // base class
  InvalidCreemSignatureError, // webhook sig mismatch
  MissingTrackingError,       // strictTracking: true and no visitor ID
  DataFastRequestError,       // DataFast HTTP error (.status, .retryable)
} from 'creem-datafast-integration';
```

---

## Supported events

| CREEM event | Forwarded to DataFast as |
|---|---|
| `checkout.completed` | One-time payment |
| `subscription.paid` | Recurring payment (`renewal: true`) |
| `refund.created` | Refund (`refund: true`, negative amount) |

---

## npm package

- **Package**: `creem-datafast-integration`
- **Registry**: https://www.npmjs.com/package/creem-datafast-integration
- **GitHub**: https://github.com/samolubukun/Creem-DataFast-Integration
