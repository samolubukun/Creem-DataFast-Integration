# creem-datafast

TypeScript package that automatically connects [CREEM](https://creem.io) payments to [DataFast](https://datafa.st) analytics for revenue attribution. Merchants can attribute revenue to traffic sources without writing any glue code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Wraps the core `creem` TypeScript SDK (not the `creem_io` wrapper)
- `createCheckout()` auto-injects `datafast_visitor_id` into CREEM checkout metadata
- Webhook handler for `checkout.completed` and `subscription.paid` events
- Maps CREEM webhook data to DataFast Payment API format (`amount`, `currency`, `transaction_id`, `datafast_visitor_id`)
- HMAC-SHA256 webhook signature verification using `creem-signature` header
- Framework adapters: **Express middleware** and **Next.js App Router** handler
- Generic handler for any framework (Hono, Fastify, Koa, Cloudflare Workers, etc.)
- Client-side helper to read `datafast_visitor_id` cookie and pass it via checkout URL or API
- TypeScript first with full type definitions

## Installation

```bash
npm install creem-datafast creem
```

## How It Works

```
Browser                        Your Server                    External
───────                        ───────────                    ────────

1. User visits site
   DataFast script sets
   datafast_visitor_id cookie

2. User clicks "Buy"
   JS reads cookie ──────────► POST /api/checkout
                                │
                                ├─ createCheckoutWithVisitorId()
                                │  injects visitor ID into metadata
                                │
                                └─ CREEM API ──────────────────► CREEM
                                   returns checkoutUrl

3. User completes payment                                      CREEM
                                                                 │
4. CREEM fires webhook ──────► POST /webhooks/creem              │
                                │                                │
                                ├─ Verify creem-signature (HMAC) │
                                ├─ Extract visitor ID from       │
                                │  checkout metadata             │
                                ├─ Map amount/currency/txn_id    │
                                │                                │
                                └─ POST /api/v1/payments ──────► DataFast
                                   { amount, currency,
                                     transaction_id,
                                     datafast_visitor_id }
```

## Quick Start

### 1. Add DataFast Tracking Script

Include this in your website's `<head>`:

```html
<script async defer src="https://cdn.datafa.st/tracking.js"></script>
```

This sets the `datafast_visitor_id` cookie automatically.

### 2. Express.js

```typescript
import express from 'express';
import { createCreemDataFastClient, creemDataFastWebhook } from 'creem-datafast';

const app = express();

const creemClient = createCreemDataFastClient({
  apiKey: process.env.CREEM_API_KEY!,
});

// --- Create checkout (inject visitor ID into metadata) ---

app.use('/api', express.json());

app.post('/api/checkout', async (req, res) => {
  const { visitorId } = req.body; // sent from browser JS

  const checkout = await creemClient.createCheckoutWithVisitorId(
    {
      productId: 'prod_xxxxx',
      successUrl: 'https://yoursite.com/success',
    },
    visitorId ?? null
  );

  res.json(checkout);
});

// --- Webhook handler (forward payments to DataFast) ---
// Use express.raw() for proper signature verification.

app.post(
  '/webhooks/creem',
  express.raw({ type: 'application/json' }),
  creemDataFastWebhook({
    creemApiKey: process.env.CREEM_API_KEY!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET, // optional but recommended
    onPaymentSuccess: async ({ creemEvent, datafastResponse }) => {
      console.log('Revenue attributed:', datafastResponse);
    },
  })
);

app.listen(3000);
```

### 3. Next.js (App Router)

**`app/api/checkout/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createCreemDataFastClient } from 'creem-datafast';

const creemClient = createCreemDataFastClient({
  apiKey: process.env.CREEM_API_KEY!,
});

export async function POST(request: NextRequest) {
  const { visitorId } = await request.json();

  const checkout = await creemClient.createCheckoutWithVisitorId(
    {
      productId: process.env.CREEM_PRODUCT_ID!,
      successUrl: `${request.nextUrl.origin}/success`,
    },
    visitorId ?? null
  );

  return NextResponse.json(checkout);
}
```

**`app/api/webhooks/creem/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { creemDataFastWebhookHandler } from 'creem-datafast';

export async function POST(request: NextRequest) {
  return creemDataFastWebhookHandler(request, {
    creemApiKey: process.env.CREEM_API_KEY!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  });
}
```

### 4. Browser-Side (Reading the Cookie)

```javascript
// Read the visitor ID from the cookie set by DataFast's tracking script
function getCookie(name) {
  const value = '; ' + document.cookie;
  const parts = value.split('; ' + name + '=');
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

async function checkout() {
  const visitorId = getCookie('datafast_visitor_id');

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });

  const { checkoutUrl } = await res.json();
  window.location.href = checkoutUrl;
}
```

Or use the package's client-side helpers:

```typescript
import { getDataFastVisitorIdBrowser, buildCheckoutUrlWithVisitorId } from 'creem-datafast';

const visitorId = getDataFastVisitorIdBrowser();
const url = buildCheckoutUrlWithVisitorId('https://checkout.creem.io/xxx', visitorId);
```

### 5. Generic Handler (Any Framework)

```typescript
import { handleGenericWebhook } from 'creem-datafast';

const result = await handleGenericWebhook({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  getRawBody: () => rawBodyString,
  getHeaders: () => requestHeaders,
});
```

## Configuration

### Environment Variables

```bash
CREEM_API_KEY=your_creem_api_key
CREEM_PRODUCT_ID=prod_xxxxx
DATAFAST_API_KEY=your_datafast_api_key
CREEM_WEBHOOK_SECRET=your_webhook_secret   # from Dashboard > Developers > Webhooks
```

### Webhook Handler Options

```typescript
{
  creemApiKey: string;          // CREEM API key
  datafastApiKey: string;       // DataFast API key
  webhookSecret?: string;       // CREEM webhook secret (HMAC-SHA256 verification)
  cookieName?: string;          // Cookie name (default: 'datafast_visitor_id')
  onPaymentSuccess?: (data) => void;  // Called after successful DataFast API call
  onError?: (error) => void;          // Called on any error
}
```

## Webhook Payload Mapping

The package maps CREEM webhook payloads to DataFast's Payment API:

| CREEM field | DataFast field | Notes |
|---|---|---|
| `object.order.id` or `object.id` | `transaction_id` | Unique per payment |
| `object.order.amount` / `object.product.price` | `amount` | Converted from cents to decimal |
| `object.order.currency` / `object.product.currency` | `currency` | e.g. `"EUR"`, `"USD"` |
| `object.metadata.datafast_visitor_id` | `datafast_visitor_id` | Injected at checkout time |
| `object.customer.id` | `customer_id` | |
| `object.customer.email` | `email` | |
| `object.customer.name` | `name` | |
| (derived from event type) | `renewal` | `true` for `subscription.paid` |

## Webhook Signature Verification

CREEM signs webhooks with HMAC-SHA256. The signature is in the `creem-signature` header. If you provide a `webhookSecret`, this package verifies it using constant-time comparison before processing. See [CREEM webhook docs](https://docs.creem.io/code/webhooks).

## Supported Events

| Event | Description |
|---|---|
| `checkout.completed` | One-time payment completed |
| `subscription.paid` | Recurring subscription payment |

All other CREEM events are acknowledged with HTTP 200 but not forwarded.

## Examples

See the `examples/` directory for complete working apps:

- **[Express.js](examples/express/)** -- Landing page, checkout API, webhook handler
- **[Next.js](examples/nextjs/)** -- App Router with API routes

## License

[MIT](LICENSE)
