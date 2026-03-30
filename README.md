# creem-datafast-integration

TypeScript package that automatically connects [CREEM](https://creem.io) payments to [DataFast](https://datafa.st) analytics for revenue attribution. Merchant can attribute revenue to traffic sources without writing any glue code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/) ![npm](https://img.shields.io/npm/v/creem-datafast-integration)

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
- **React components** — Provider, hooks, CheckoutButton, PaymentLinkButton, TrackingInspector
- **Browser helpers** — getDataFastTracking, appendDataFastTracking, attributeCreemPaymentLink
- **Health checks** — verify API configuration with healthCheck() method
- **Webhook replay** — reprocess webhooks without idempotency checks

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
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: true
});

export async function POST(request: NextRequest) {
  const { checkoutUrl } = await creemClient.createCheckout(
    { productId: 'prod_xxx', successUrl: 'https://yoursite.com/success' },
    { request }
  );
  return NextResponse.redirect(checkoutUrl, { status: 303 });
}
```

```typescript
import { NextRequest } from 'next/server';
import { createNextJsWebhookHandler, createCreemDataFastClient } from 'creem-datafast-integration';

const client = createCreemDataFastClient({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: true
});

export const POST = createNextJsWebhookHandler(client);
```

### Express

```typescript
import express from 'express';
import { createCreemDataFastClient, createExpressWebhookHandler } from 'creem-datafast-integration';

const app = express();
const client = createCreemDataFastClient({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: true
});

app.post('/api/checkout', async (req, res) => {
  const { checkoutUrl } = await client.createCheckout(
    { productId: 'prod_xxx', successUrl: 'https://yoursite.com/success' },
    { request: { headers: req.headers, url: req.url } }
  );
  res.redirect(303, checkoutUrl);
});

app.post('/webhook/creem', express.raw({ type: 'application/json' }), createExpressWebhookHandler(client));
```

### Browser / Client-Side

```typescript
import { getDataFastTracking, attributeCreemPaymentLink } from 'creem-datafast-integration/client';

const tracking = getDataFastTracking();
// { visitorId: "xxx", sessionId: "yyy" }

// Attribute a hosted Creem payment link
const attributedLink = attributeCreemPaymentLink('https://creem.io/payment/prod_xxx', tracking);
```

### React Components

```tsx
import { CreemDataFastProvider, CreemCheckoutButton, TrackingInspector } from 'creem-datafast-integration/react';

export function App() {
  return (
    <CreemDataFastProvider websiteId="your-website-id">
      <TrackingInspector />
      <CreemCheckoutButton action="/api/checkout">Buy Now</CreemCheckoutButton>
    </CreemDataFastProvider>
  );
}
```

## API Reference

### Client Methods

| Method | Description |
|--------|-------------|
| `createCheckout(params, context)` | Create checkout with DataFast tracking injected |
| `handleWebhook({ rawBody, headers })` | Verify and forward webhook to DataFast |
| `replayWebhook({ rawBody, headers })` | Reprocess webhook without idempotency |
| `verifyWebhookSignature(rawBody, headers)` | Verify creem-signature header |
| `forwardPayment(payment)` | Manually forward payment to DataFast |
| `healthCheck()` | Verify API configuration |

### Tracking Resolution Order

`createCheckout()` resolves tracking in this order:

1. Explicit `tracking` parameter
2. Metadata `datafast_*` fields  
3. URL query params `datafast_*`
4. Cookies `datafast_visitor_id` / `datafast_session_id`

### Error Types

| Error | Description |
|-------|-------------|
| `CreemDataFastError` | Base error class |
| `InvalidCreemSignatureError` | Signature verification failed |
| `MissingTrackingError` | No visitor ID in strict mode |
| `DataFastRequestError` | DataFast API failed (has `retryable` property) |
| `TrackingCollisionError` | Tracking ID conflict detected |
| `UnsupportedEventError` | Unsupported webhook event |

## Configuration

```typescript
{
  creemApiKey: string;              // CREEM API key
  creemWebhookSecret: string;       // For signature verification
  datafastApiKey: string;           // DataFast API key
  datafastApiBaseUrl?: string;      // Custom DataFast endpoint
  testMode?: boolean;               // Use test API (default: false)
  timeoutMs?: number;               // Request timeout (default: 8000)
  retry?: {                         // Retry config
    retries?: number;              
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  strictTracking?: boolean;         // Throw if no visitor ID
  captureSessionId?: boolean;       // Include session ID in tracking
  webhookDryRun?: boolean;          // Don't actually forward to DataFast
}
```

## Supported Events

| Event | Description |
|-------|-------------|
| `checkout.completed` | One-time payment completed |
| `subscription.paid` | Recurring subscription payment |
| `refund.created` | Refund issued (forwards as `refunded: true`) |

## License

[MIT](LICENSE)