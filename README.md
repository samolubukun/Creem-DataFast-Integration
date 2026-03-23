# creem-datafast-integration

[![CI](https://github.com/samolubukun/Creem-DataFast-Integration/actions/workflows/ci.yml/badge.svg)](https://github.com/samolubukun/Creem-DataFast-Integration/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/creem-datafast-integration.svg)](https://www.npmjs.com/package/creem-datafast-integration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Connect [Creem](https://creem.io) payments to [DataFast](https://datafa.st) with production-ready checkout attribution and webhook forwarding.

## Table of Contents

- [Judge in 2 minutes](#judge-in-2-minutes)
- [Migration Notes](#migration-notes)
- [Production Checklist](#production-checklist)
- [Compatibility Matrix](#compatibility-matrix)
- [Installation](#installation)
- [Examples](#examples)
- [Smoke Test (signed webhook fixture)](#smoke-test-signed-webhook-fixture)
- [Quickstart (2 minutes)](#quickstart-2-minutes)
- [Core API](#core-api)
- [Extended API](#extended-api)
- [Configuration](#configuration)
- [Idempotency Stores](#idempotency-stores)
- [Framework Adapters](#framework-adapters)
- [Browser Helpers](#browser-helpers)
- [Errors](#errors)

## Judge in 2 minutes

1. Create a checkout with cookie-based tracking capture.
2. Replay a signed webhook fixture through your local webhook route.
3. Confirm `200 OK` and inspect logs for mapping + forwarding path.

```bash
npm install
npm run build
```

Run your app and replay a signed fixture:

```bash
WEBHOOK_URL=http://localhost:3000/api/webhook/creem \
CREEM_WEBHOOK_SECRET=whsec_xxx \
npm run smoke:webhook
```

## Migration Notes

- Prefer `webhookDryRun` over deprecated `dryRun`.
- Prefer `health.ok` over deprecated `health.healthy`.

## Production Checklist

- Use `express.raw({ type: 'application/json' })` for Express webhook routes.
- Configure a durable idempotency store for multi-instance deployments.
- Keep `CREEM_WEBHOOK_SECRET` and `DATAFAST_API_KEY` set in server env only.
- Run `healthCheck()` on deploy and alert when `health.ok` is false.

## Compatibility Matrix

- Node.js: `>=18`
- Next.js App Router: supported via `creem-datafast-integration/next`
- Express: supported via `creem-datafast-integration/express`
- ESM: supported
- Bun/Workers: core flow is framework-agnostic; validate in your own runtime before production

## Installation

```bash
npm install creem-datafast-integration
```

## Examples

- Next.js: `examples/nextjs`
- Express: `examples/express`

See `examples/README.md` for run steps.

## Smoke Test (signed webhook fixture)

Run against your local webhook endpoint:

```bash
WEBHOOK_URL=http://localhost:3000/api/webhook/creem \
CREEM_WEBHOOK_SECRET=whsec_xxx \
npm run smoke:webhook
```

## Quickstart (2 minutes)

Create one shared client, use it for checkout creation, and wire one webhook route.

```ts
// lib/creem-datafast.ts
import { createCreemDataFast } from 'creem-datafast-integration';

export const creemDataFast = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: process.env.NODE_ENV !== 'production',
});
```

```ts
// app/api/checkout/route.ts (Next.js)
import { NextResponse } from 'next/server';
import { creemDataFast } from '@/lib/creem-datafast';

export async function POST(request: Request) {
  const { checkoutUrl } = await creemDataFast.createCheckout(
    {
      productId: process.env.CREEM_PRODUCT_ID!,
      successUrl: `${process.env.APP_BASE_URL!}/success`,
    },
    { request }
  );

  return NextResponse.redirect(checkoutUrl, { status: 303 });
}
```

```ts
// app/api/webhook/creem/route.ts (Next.js)
import { createNextWebhookHandler } from 'creem-datafast-integration/next';
import { creemDataFast } from '@/lib/creem-datafast';

export const POST = createNextWebhookHandler(creemDataFast);
```

Supported webhook events: `checkout.completed`, `subscription.paid`, `refund.created`.

## Core API

### `createCheckout(params, context?)`

Creates a Creem checkout and injects DataFast tracking (`datafast_visitor_id`, optional `datafast_session_id`) into metadata.

```ts
const checkout = await cd.createCheckout(
  {
    productId: 'prod_123',
    successUrl: 'https://app.example/success',
    metadata: { plan: 'pro' },
    mergeStrategy: 'preserve', // preserve | overwrite | error
  },
  { request } // optional; reads cookies + query params
);

console.log(checkout.checkoutUrl);
```

### `handleWebhook({ rawBody, headers })`

Verifies Creem signature, validates payload, maps supported events, and forwards to DataFast.

Supported events:
- `checkout.completed`
- `subscription.paid`
- `refund.created`

```ts
const result = await cd.handleWebhook({
  rawBody,
  headers: req.headers,
});
```

### `replayWebhook({ rawBody, headers })`

Reprocesses a webhook while bypassing idempotency claim checks.

```ts
await cd.replayWebhook({ rawBody, headers });
```

### `verifyWebhookSignature(rawBody, headers)`

Verifies the `creem-signature` header using HMAC SHA-256.

## Extended API

### `buildCheckoutUrl({ checkoutUrl, visitorId, sessionId, mergeStrategy })`

Appends tracking query params to a checkout URL.

```ts
const url = cd.buildCheckoutUrl({
  checkoutUrl: 'https://checkout.creem.io/p/abc',
  visitorId: 'v_123',
  sessionId: 's_456',
});
```

### `healthCheck()`

Returns a health snapshot for Creem credentials, webhook secret, and DataFast reachability.

`health.ok` is the canonical readiness flag. `health.healthy` is deprecated and kept only for backwards compatibility.

```ts
const health = await cd.healthCheck();
```

### `sendPayments(payloads)`

Sends multiple DataFast payment payloads sequentially and returns per-item success/failure.

```ts
const batch = await cd.sendPayments([
  { amount: 10, currency: 'USD', transaction_id: 'tx_1', renewal: false },
  { amount: 20, currency: 'USD', transaction_id: 'tx_2', renewal: true },
]);
```

### `getPayments(visitorId)`

Fetches DataFast payment history for a visitor id.

```ts
const payments = await cd.getPayments('visitor_123');
```

### `creem`

Access the underlying Creem client instance.

```ts
const transaction = await cd.creem.getTransactionById('tran_123');
```

## Configuration

```ts
type CreemDataFastOptions = {
  creemApiKey?: string;
  creemClient?: {
    checkouts: { create(params: unknown): Promise<unknown> };
    transactions: { getById(id: string): Promise<unknown> };
  };
  creemWebhookSecret: string;
  datafastApiKey: string;
  datafastApiBaseUrl?: string;
  testMode?: boolean;
  timeoutMs?: number;
  retry?: {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  strictTracking?: boolean;
  captureSessionId?: boolean;
  hydrateTransactionOnSubscriptionPaid?: boolean;

  // webhook controls
  webhookDryRun?: boolean; // preferred name
  dryRun?: boolean; // deprecated legacy alias
  eventFilter?: Array<'checkout.completed' | 'subscription.paid' | 'refund.created'>;
  onDeadLetter?: (context: {
    eventType: string;
    eventId: string;
    transactionId: string;
    error: Error;
    attempts: number;
  }) => void | Promise<void>;

  idempotencyStore?: {
    claim(key: string, ttlSeconds?: number): Promise<boolean>;
    complete(key: string, ttlSeconds?: number): Promise<void>;
    release(key: string): Promise<void>;
  };
  idempotencyInFlightTtlSeconds?: number;
  idempotencyProcessedTtlSeconds?: number;
};
```

## Idempotency Stores

See `docs/production-idempotency.md` for production guidance, TTL tuning, and failure modes.

In-memory store (default):

```ts
import { MemoryIdempotencyStore } from 'creem-datafast-integration';

const store = new MemoryIdempotencyStore();
```

Upstash Redis store:

```ts
import { Redis } from '@upstash/redis';
import { UpstashIdempotencyStore } from 'creem-datafast-integration';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const idempotencyStore = UpstashIdempotencyStore(redis);
```

## Framework Adapters

### Next.js App Router

```ts
import { createNextWebhookHandler } from 'creem-datafast-integration/next';
import { cd } from '@/lib/billing';

export const POST = createNextWebhookHandler(cd);
```

### Express

```ts
import express from 'express';
import { createExpressWebhookHandler } from 'creem-datafast-integration/express';
import { cd } from './billing';

const app = express();

app.post(
  '/webhooks/creem',
  express.raw({ type: 'application/json' }),
  createExpressWebhookHandler(cd)
);
```

## Browser Helpers

### ESM helpers

```ts
import { appendDataFastTracking, getDataFastTracking } from 'creem-datafast-integration/client';
```

### Auto-init script

```html
<script
  async
  defer
  src="https://cdn.jsdelivr.net/npm/creem-datafast-integration/dist/browser.js"
  data-auto-init
></script>
```

This scans `a[href*="checkout.creem.io"]` links and appends available DataFast tracking query params.

## Errors

Exported errors include:
- `CreemDataFastError`
- `InvalidCreemSignatureError`
- `MissingTrackingError`
- `MetadataCollisionError`
- `UnsupportedWebhookEventError`
- `DataFastRequestError`
- `TransactionHydrationError`
- `WebhookValidationError`

## Security

See `SECURITY.md` for vulnerability reporting and operational hardening guidance.

## License

MIT
