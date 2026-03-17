# SKILL: Creem DataFast Premium Engine Integration

This skill provides the comprehensive context for integrating [CREEM](https://creem.io) with [DataFast](https://datafa.st) using the `creem-datafast-integration` Premium Engine.

## 🏗️ Architecture: Premium Engine

The package follows a domain-driven "Premium Engine" architecture:

- **Foundation**: Types and custom Errors.
- **Infrastructure**: HTTP/Cookie/Amount utilities.
- **Engine**: Checkout creation, Webhook handling, Transaction Hydration, and Signature Verification.
- **Gateways**: Official adapters for Next.js and Express.
- **Storage**: Atomic idempotency stores (Memory & Upstash).
- **Browser**: Zero-config tracking resolution script.

## 🏁 Core Pattern: The Unified Factory

Always use `createCreemDataFast` to initialize the client. This wires up all internal services (Creem SDK, DataFast API, Logger, Idempotency).

```ts
import { createCreemDataFast } from 'creem-datafast-integration';

const creemDataFast = createCreemDataFast({
  creemApiKey: '...',
  creemWebhookSecret: '...',
  datafastApiKey: '...',
});
```

## 🛒 Checkout Creation

Attribution happens automatically if you pass the `request` or `headers` in the context.

```ts
// In Next.js App Router
const { checkoutUrl } = await creemDataFast.createCheckout(
  { productId: 'prod_123', successUrl: '/success' },
  { request }
);

// In Express
const { checkoutId } = await creemDataFast.createCheckout(
  { productId: 'prod_123', successUrl: '/success' },
  { request: { headers: req.headers, url: req.url } }
);
```

## 🪝 Webhook Processing

The engine handles signature verification, deduplication, payload mapping, and event hydration automatically.

```ts
// Next.js (app/api/webhooks/creem/route.ts)
import { createNextWebhookHandler } from 'creem-datafast-integration/next';
export const POST = createNextWebhookHandler(creemDataFast);

// Express
import { createExpressWebhookHandler } from 'creem-datafast-integration/express';
app.post('/webhook', express.raw({ type: 'application/json' }), createExpressWebhookHandler(creemDataFast));
```

## 💧 Transaction Hydration

The engine automatically fetches the full transaction for `subscription.paid` events to ensure 100% accurate price and currency reporting in DataFast. This overcomes payload limitations in standard Creem webhooks.

## 🛡️ Distributed Idempotency

Use the Upstash adapter for production environments to prevent duplicate revenue reporting across multi-instance deployments.

```ts
import { createUpstashIdempotencyStore } from 'creem-datafast-integration/idempotency/upstash';
// Pass to createCreemDataFast options
```

## 🌐 Browser Tracking

Include the browser script for zero-config tracking:
`<script src=".../dist/client.js" data-auto-init="true"></script>`

## 📜 Supported Events

- `checkout.completed` -> One-time purchase
- `subscription.paid` -> Subscription revenue (Auto-Hydrated)
- `refund.created` -> Revenue reversal
