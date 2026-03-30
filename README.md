# creem-datafast-integration

TypeScript package that automatically connects [CREEM](https://creem.io) payments to [DataFast](https://datafa.st) analytics for revenue attribution. Merchants can attribute revenue to traffic sources without writing any glue code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Zero glue code** — one factory call wires up checkout attribution and webhook forwarding
- **Framework adapters** — Next.js App Router and Express out of the box, or bring your own
- **Production-ready** — idempotent webhooks, retries with backoff, HMAC-SHA256 signature verification
- **Refund support** — forwards `refund.created` as `refunded: true` payment events
- **Currency-aware** — correctly converts zero-decimal (JPY, KRW) and three-decimal (KWD, BHD) currencies
- **Session tracking** — captures both `datafast_visitor_id` and `datafast_session_id`
- **Strict tracking mode** — optionally throw errors when visitor ID is missing
- **Distributed idempotency** — Upstash Redis adapter for serverless/multi-instance deployments
- **Configurable** — timeout, retry logic, custom logger
- **TypeScript first** — full type definitions included

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
import { NextRequest, NextResponse } from 'next/server';
import { createCreemDataFastClient } from 'creem-datafast-integration';

const creemClient = createCreemDataFastClient({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  testMode: true
});

export async function POST(request: NextRequest) {
  const { checkoutUrl } = await creemClient.createCheckout(
    { productId: process.env.CREEM_PRODUCT_ID! },
    { request }
  );

  return NextResponse.redirect(checkoutUrl, { status: 303 });
}
```

```typescript
import { creemDataFastWebhookHandler } from 'creem-datafast-integration';

export async function POST(request: NextRequest) {
  return creemDataFastWebhookHandler(request, {
    creemApiKey: process.env.CREEM_API_KEY!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  });
}
```

### Express

```typescript
import express from 'express';
import { createCreemDataFastClient, creemDataFastWebhook } from 'creem-datafast-integration';

const app = express();
const creemClient = createCreemDataFastClient({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
});

app.post('/api/checkout', async (req, res) => {
  const { checkoutUrl } = await creemClient.createCheckout(
    { productId: process.env.CREEM_PRODUCT_ID! },
    { request: { headers: req.headers, url: req.url } }
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

### Client-Side

```typescript
import { getDataFastVisitorIdBrowser, buildCheckoutUrlWithVisitorId } from 'creem-datafast-integration/client';

const visitorId = getDataFastVisitorIdBrowser();
const url = buildCheckoutUrlWithVisitorId('https://checkout.creem.io/xxx', visitorId);
```

## Advanced

### Strict Tracking Mode

Throw an error when no visitor ID is found at checkout:

```typescript
const creemClient = createCreemDataFastClient({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  strictTracking: true, // throws MissingTrackingError if no visitor ID
});
```

### Idempotency (Production)

For multi-instance deployments, use Upstash Redis:

```bash
npm install @upstash/redis creem-datafast-integration
```

```typescript
import { Redis } from '@upstash/redis';
import { createCreemDataFastClient, createUpstashIdempotencyStore } from 'creem-datafast-integration';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

const creemClient = createCreemDataFastClient({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  idempotencyStore: createUpstashIdempotencyStore(redis)
});
```

### Configuration Options

```typescript
{
  creemApiKey: string;           // CREEM API key
  creemWebhookSecret?: string;   // For signature verification
  datafastApiKey: string;        // DataFast API key
  testMode?: boolean;            // Use test API (default: false)
  timeoutMs?: number;            // DataFast request timeout (default: 8000)
  retry?: {
    retries?: number;           // Extra attempts (default: 1)
    baseDelayMs?: number;       // Base backoff (default: 250)
    maxDelayMs?: number;        // Max backoff (default: 2000)
  };
  strictTracking?: boolean;       // Throw if no visitor ID (default: false)
  idempotencyStore?: IdempotencyStore;
  logger?: Logger;              // Custom logger
}
```

### Error Handling

```typescript
import {
  CreemDataFastError,
  InvalidCreemSignatureError,
  MissingTrackingError,
  DataFastRequestError
} from 'creem-datafast-integration';

try {
  // ...
} catch (error) {
  if (error instanceof InvalidCreemSignatureError) {
    // Invalid webhook signature
  } else if (error instanceof MissingTrackingError) {
    // No visitor ID in strict mode
  } else if (error instanceof DataFastRequestError) {
    // DataFast API failed
    if (error.retryable) {
      // Can retry
    }
  }
}
```

## Supported Events

| Event | Description |
|---|---|
| `checkout.completed` | One-time payment completed |
| `subscription.paid` | Recurring subscription payment |
| `refund.created` | Refund issued (forwards as `refunded: true`) |

## Currency Handling

- **Standard currencies** (USD, EUR, GBP): amounts in cents → decimal (2999 → 29.99)
- **Zero-decimal currencies** (JPY, KRW, VND): amounts stay as-is
- **Three-decimal currencies** (KWD, BHD, OMR): amounts divided by 1000

## License

[MIT](LICENSE)
