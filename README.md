# creem-datafast-integration

Connect [Creem](https://creem.io) payments to [DataFast](https://datafa.st) with production-ready checkout attribution and webhook forwarding.

## Installation

```bash
npm install creem-datafast-integration
```

## Quick Start

```ts
import { createCreemDataFast } from 'creem-datafast-integration';

const cd = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: process.env.NODE_ENV !== 'production',
});
```

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

  // parity features
  dryRun?: boolean;
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

## License

MIT
