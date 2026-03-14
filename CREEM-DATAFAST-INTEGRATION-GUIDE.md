# CREEM × DataFast Integration Guide
### TypeScript Package: Automatic Revenue Attribution

> **One-line summary:** Wrap the Creem TypeScript SDK so that every checkout
> auto-captures the `datafast_visitor_id` cookie and every successful payment
> is forwarded to DataFast's Payment API — with zero glue code for the merchant.

> **Sources (all ground truth, fetched directly):**
> - https://docs.creem.io — Creem overview & quickstart
> - https://docs.creem.io/code/sdks/typescript-core — Core SDK (`creem`)
> - https://docs.creem.io/code/webhooks — Webhook events & signature verification
> - https://datafa.st/docs/payments-api — DataFast Payment API spec
> - https://datafa.st/docs/api-create-payment — DataFast revenue attribution guide

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Integration Works](#2-how-the-integration-works)
3. [Prerequisites & API Keys](#3-prerequisites--api-keys)
4. [Platform Reference: Creem](#4-platform-reference-creem)
   - 4.1 [Core SDK (`creem`) — Installation & Init](#41-core-sdk-creem--installation--init)
   - 4.2 [SDK API Resources (Full Reference)](#42-sdk-api-resources-full-reference)
   - 4.3 [createCheckout() — Injecting DataFast Metadata](#43-createcheckout--injecting-datafast-metadata)
   - 4.4 [Webhook Events Reference](#44-webhook-events-reference)
   - 4.5 [Webhook Signature Verification](#45-webhook-signature-verification)
   - 4.6 [Client-Side Checkout URL Approach](#46-client-side-checkout-url-approach)
5. [Platform Reference: DataFast](#5-platform-reference-datafast)
   - 5.1 [Payment API — Full Spec](#51-payment-api--full-spec)
   - 5.2 [Attribution Flow (DataFast's Recommended Pattern)](#52-attribution-flow-datafasts-recommended-pattern)
   - 5.3 [Field Mapping: Creem to DataFast](#53-field-mapping-creem-to-datafast)
6. [Package Architecture](#6-package-architecture)
   - 6.1 [Directory Structure](#61-directory-structure)
   - 6.2 [Full TypeScript Type Definitions](#62-full-typescript-type-definitions)
7. [Core Implementation](#7-core-implementation)
   - 7.1 [Cookie Utilities](#71-cookie-utilities)
   - 7.2 [CreemDataFast Client](#72-creemdatafast-client)
   - 7.3 [DataFast Reporter](#73-datafast-reporter)
   - 7.4 [Generic Webhook Handler](#74-generic-webhook-handler)
   - 7.5 [Package Entry Point](#75-package-entry-point)
8. [Framework Adapters](#8-framework-adapters)
   - 8.1 [Express Middleware](#81-express-middleware)
   - 8.2 [Next.js App Router Helper](#82-nextjs-app-router-helper)
9. [Quickstart: Express](#9-quickstart-express)
10. [Quickstart: Next.js](#10-quickstart-nextjs)
11. [End-to-End Flow Walkthrough](#11-end-to-end-flow-walkthrough)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [Error Handling & Idempotency](#13-error-handling--idempotency)
14. [Testing Locally](#14-testing-locally)
15. [package.json & tsconfig.json](#15-packagejson--tsconfigjson)

---

## 1. Architecture Overview

```
Browser                       Your Server                    External APIs
-------                       -----------                    -------------

(1) Visitor lands on page
  DataFast script runs ->
  Sets cookie:
  datafast_visitor_id=abc-123
         |
         | (2) Click "Buy"
         v
POST /api/checkout ----------> readCookieFromRequest(req)
  (cookie header sent                    |
   automatically by browser)             | datafast_visitor_id=abc-123
                                         v
                              creem.checkouts.create({
                                productId: "prod_xxx",
                                metadata: {
                                  datafast_visitor_id: "abc-123"
                                }                         ---> Creem API
                              })
                                         |
                                         v
                              checkout.checkoutUrl
         <--------------------------------------
         Redirect customer ->
         checkout.creem.io/ch_xxx

(3) Customer pays on Creem-hosted page
         |
         | (4) Creem fires webhook
         v
POST /api/webhooks/creem -----> verifySignature
                              (HMAC-SHA256,
                               creem-signature header)
                                         |
                               ----------+----------
                               |                   |
                    checkout.completed   subscription.paid
                               |                   |
                               ----------+----------
                                         |
                              Extract metadata:
                              datafast_visitor_id=abc-123
                                         |
                                         v
                              POST https://datafa.st/api/v1/payments
                              {
                                amount: 29.99,
                                currency: "USD",
                                transaction_id: "ord_xxx",
                                datafast_visitor_id: "abc-123",
                                renewal: false
                              }
                                         |
                                         v
                              Revenue attributed to
                              traffic source (check)

(5) Return 200 OK to Creem (prevents retry)
```

---

## 2. How the Integration Works

The attribution loop has three steps, which maps exactly to DataFast's own recommended pattern:

> *"Capture DataFast's visitor ID from the cookie `datafast_visitor_id`. Store it
> in your database or pass it to your payment provider when creating checkout
> sessions (metadata). Send payment data to DataFast when you receive a successful
> payment (your webhook handler, a success page, etc.)"*
> — DataFast Revenue Attribution Guide

**Step 1 — Visitor Identification (Browser)**
The DataFast tracking script sets a first-party cookie called `datafast_visitor_id` on every page load. This UUID ties all browsing activity — pageviews, UTM params, referral source — to a single visitor identity.

**Step 2 — Cookie Injection at Checkout (Server)**
When `createCheckout()` is called, the package reads `datafast_visitor_id` from the incoming request cookies and injects it into Creem's `metadata` field. Creem persists this metadata on the checkout session and echoes it back verbatim in every subsequent webhook event for that checkout and its subscription lifecycle.

**Step 3 — Revenue Attribution (Webhook)**
On `checkout.completed` (one-time or first subscription payment) and `subscription.paid` (renewals), the webhook handler extracts `metadata.datafast_visitor_id`, maps Creem's payment fields to DataFast's format, and posts to `https://datafa.st/api/v1/payments`. DataFast attributes the revenue to the correct traffic source.

---

## 3. Prerequisites & API Keys

### Creem

| Item | Where | Env var |
|---|---|---|
| API Key | Dashboard -> Developers -> API Keys | `CREEM_API_KEY` |
| Webhook Secret | Dashboard -> Developers -> Webhooks | `CREEM_WEBHOOK_SECRET` |
| Product ID | Dashboard -> Products | Per-checkout |

- Test keys are prefixed `creem_test_`
- `serverIdx: 0` -> Production (`api.creem.io`)
- `serverIdx: 1` -> Test (`test-api.creem.io`)
- Optional: `CREEM_DEBUG=true` enables SDK debug logs

### DataFast

| Item | Where | Env var |
|---|---|---|
| API Key | DataFast Dashboard -> Settings | `DATAFAST_API_KEY` |
| Website ID | DataFast Dashboard | `NEXT_PUBLIC_DATAFAST_ID` |
| Payments endpoint | Fixed | `https://datafa.st/api/v1/payments` |
| Auth | Bearer token | `Authorization: Bearer {DATAFAST_API_KEY}` |

> **Note:** If you are using Stripe, LemonSqueezy, or Polar, DataFast tracks payments
> automatically via native integrations. The Payment API (and this package) is for
> all other providers including Creem.

---

## 4. Platform Reference: Creem

### 4.1 Core SDK (`creem`) — Installation & Init

> WARNING: Use `creem` (Core SDK), NOT `creem_io` (SDK Wrapper).
> The core `creem` package provides full API access, all endpoints, and maximum
> flexibility for advanced integrations. The `creem_io` wrapper is a separate
> package that adds opinionated Next.js helpers but has less flexibility.

```bash
npm install creem
```

**Standard initialization:**

```typescript
import { Creem } from 'creem';

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: 0, // 0 = production | 1 = test
});
```

**Tree-shakable initialization (serverless / edge):**

```typescript
import { CreemCore } from 'creem/core.js';
import { checkoutsCreate } from 'creem/funcs/checkoutsCreate.js';
import { productsGet } from 'creem/funcs/productsGet.js';

const creem = new CreemCore({
  apiKey: process.env.CREEM_API_KEY!,
});

const res = await checkoutsCreate(creem, {
  productId: 'prod_xxxxx',
  successUrl: 'https://yourapp.com/success',
  metadata: { datafast_visitor_id: 'abc-123' },
});

if (!res.ok) throw res.error;
console.log(res.value.checkoutUrl);
```

**Key SDK behaviours (confirmed from official docs):**
- All API responses are fully typed with comprehensive TypeScript definitions
- The SDK automatically converts `snake_case` to `camelCase` — so `checkout_url` from the raw API becomes `checkout.checkoutUrl` in TypeScript
- The core `creem` package does NOT include webhook routing or signature verification helpers — these must be implemented manually (see section 4.5)
- Configurable retry strategies with backoff options
- `CREEM_DEBUG=true` env var enables debug logging

**Confirmed type import path:**

```typescript
import type {
  CheckoutEntity,
  CustomerEntity,
  ProductEntity,
  SubscriptionEntity,
  TransactionEntity,
  LicenseEntity,
  DiscountEntity,
} from 'creem/models/components';
```

---

### 4.2 SDK API Resources (Full Reference)

#### Checkouts

```typescript
// Create a checkout session
const checkout = await creem.checkouts.create({
  productId: 'prod_xxxxx',           // Required
  units: 2,                           // Optional: number of units (default: 1)
  discountCode: 'SUMMER2024',         // Optional
  customer: {
    email: 'customer@example.com',    // Optional: pre-fill
  },
  customFields: [                     // Optional: max 3 fields
    {
      key: 'company',
      label: 'Company Name',
      type: 'text',
      optional: false,
    },
  ],
  successUrl: 'https://yourapp.com/success',
  metadata: {
    userId: 'user_123',
    datafast_visitor_id: 'abc-123',   // <- key field for attribution
  },
});

// SDK converts snake_case -> camelCase: checkout_url -> checkoutUrl
console.log(checkout.checkoutUrl); // Redirect user here

// Retrieve an existing checkout
const retrieved = await creem.checkouts.retrieve('chck_1234567890');
```

#### Products

```typescript
const products = await creem.products.search(1, 10);
const product  = await creem.products.get('prod_xxx');

const created = await creem.products.create({
  name: 'Pro Plan',
  description: 'Monthly subscription',
  price: 2999,               // In cents
  currency: 'USD',
  billingType: 'recurring',
  billingPeriod: 'every-month',
});
```

#### Customers

```typescript
const list    = await creem.customers.list(1, 10);
const byId    = await creem.customers.retrieve('cust_abc123');
const byEmail = await creem.customers.retrieve(undefined, 'user@example.com');
const portal  = await creem.customers.generateBillingLinks({ customerId: 'cust_abc123' });
console.log(portal.customerPortalLink);
```

#### Subscriptions

```typescript
const sub = await creem.subscriptions.get('sub_abc123');

const canceled = await creem.subscriptions.cancel('sub_abc123', {
  mode: 'immediate',
});

const updated = await creem.subscriptions.update('sub_abc123', {
  items: [{ id: 'item_abc123', units: 5 }],
  updateBehavior: 'proration-charge-immediately',
  // Options:
  // 'proration-charge-immediately' - charge proration now
  // 'proration-charge'             - charge proration at next cycle
  // 'proration-none'               - switch plan, no proration
});

const upgraded = await creem.subscriptions.upgrade('sub_abc123', {
  productId: 'prod_premium',
  updateBehavior: 'proration-charge-immediately',
});
```

#### Licenses

```typescript
const activated = await creem.licenses.activate({
  key: 'license_key_here',
  instanceName: 'Production Server',
});

const validated = await creem.licenses.validate({
  key: 'license_key_here',
  instanceId: activated.instance?.id,
});
// validated.status -> "active" | "inactive" | "expired" | "disabled"

await creem.licenses.deactivate({
  key: 'license_key_here',
  instanceId: 'inst_abc123',
});
```

#### Discounts

```typescript
const discount = await creem.discounts.create({
  name: 'Summer Sale',
  code: 'SUMMER2024',       // Optional: auto-generated if omitted
  type: 'percentage',
  percentage: 20,
  duration: 'forever',      // "forever" | "once" | "repeating"
  maxRedemptions: 100,
  appliesToProducts: ['prod_xxxxx'],
});

const byId   = await creem.discounts.get('disc_xxxxx');
const byCode = await creem.discounts.get(undefined, 'SUMMER2024');
await creem.discounts.delete('disc_xxxxx');
```

#### Transactions

```typescript
const tx = await creem.transactions.getById('txn_xxxxx');

const txList = await creem.transactions.search(
  'cust_xxxxx', // customerId  (optional)
  undefined,    // orderId     (optional)
  undefined,    // productId   (optional)
  1,            // page
  50            // pageSize
);
```

---

### 4.3 `createCheckout()` — Injecting DataFast Metadata

The entire attribution strategy hinges on injecting `datafast_visitor_id` into
Creem's `metadata` at checkout creation time. Creem stores this metadata on the
checkout session object and echoes it verbatim in every subsequent webhook event
for that checkout, its order, and the entire subscription lifecycle.

```typescript
import { Creem } from 'creem';
import { IncomingMessage } from 'http';

function readVisitorIdFromCookies(req: IncomingMessage): string | undefined {
  const cookieHeader = req.headers['cookie'] ?? '';
  const match = cookieHeader
    .split(';')
    .find(c => c.trim().startsWith('datafast_visitor_id='));
  return match?.split('=')[1]?.trim();
}

async function createCheckoutWithAttribution(
  req: IncomingMessage,
  productId: string,
  successUrl: string,
  extraMetadata?: Record<string, string>
) {
  const creem = new Creem({
    apiKey: process.env.CREEM_API_KEY!,
    serverIdx: process.env.NODE_ENV === 'production' ? 0 : 1,
  });

  const visitorId = readVisitorIdFromCookies(req);

  const checkout = await creem.checkouts.create({
    productId,
    successUrl,
    metadata: {
      ...extraMetadata,
      // Injected here -- echoed in ALL future webhook events for this checkout
      ...(visitorId ? { datafast_visitor_id: visitorId } : {}),
    },
  });

  // SDK auto-converts snake_case -> camelCase
  return checkout.checkoutUrl;
}
```

---

### 4.4 Webhook Events Reference

Creem sends `POST` requests to your registered HTTPS webhook URL. Every event
shares this envelope:

```typescript
{
  id: string;          // "evt_5WHHcZPv7VS0YUsberIuOz"
  eventType: string;   // one of the values below
  created_at: number;  // Unix timestamp in milliseconds
  object: { ... };     // event-specific payload
}
```

Always respond with **HTTP 200 OK** to signal successful delivery. Non-2xx
responses trigger the retry schedule.

#### Events that trigger DataFast reporting

| Event | When | DataFast `renewal` field |
|---|---|---|
| `checkout.completed` | One-time payment OR first subscription payment | `false` (default) |
| `subscription.paid` | Each subsequent renewal billing cycle | `true` |

> Use `subscription.paid` — not `subscription.active` — to grant product access.
> `subscription.active` is for synchronisation only, per Creem docs.

#### Full event type reference

| Event | Description |
|---|---|
| `checkout.completed` | Checkout session completed; order created and paid |
| `subscription.active` | New subscription created — sync only, do not grant access here |
| `subscription.paid` | Subscription renewal transaction paid |
| `subscription.canceled` | Canceled immediately by merchant or customer |
| `subscription.scheduled_cancel` | Cancel scheduled for end of period; reversible via Resume Subscription API |
| `subscription.past_due` | Payment failed; Creem auto-retries per backoff schedule |
| `subscription.expired` | Period ended without payment; may still retry before canceled |
| `subscription.trialing` | Trial period started |
| `subscription.paused` | Subscription paused |
| `subscription.update` | Subscription modified (seats, plan, etc.) |
| `refund.created` | Refund issued by merchant |
| `dispute.created` | Chargeback filed by customer |

#### `checkout.completed` payload shape

```typescript
// event.object for checkout.completed
{
  id: string;                    // "ch_4l0N34kxo16AhRKUHFUuXr"
  object: "checkout";
  request_id?: string;
  order: {
    id: string;                  // "ord_xxx" -- use as transaction_id for DataFast
    customer: string;            // customer ID ref
    product: string;             // product ID ref
    amount: number;              // WARNING: IN CENTS -- divide by 100 for DataFast
    currency: string;            // "EUR", "USD", "GBP", etc.
    status: "paid";
    type: "one_time" | "recurring";
    created_at: string;
    updated_at: string;
    mode: string;
  };
  product: {
    id: string;
    name: string;
    price: number;               // In cents
    currency: string;
    billing_type: "one_time" | "recurring";
    billing_period?: string;     // "every-month", "every-year"
    status: "active";
    tax_mode: "exclusive" | "inclusive";
    tax_category: string;
  };
  customer: {
    id: string;
    object: "customer";
    email: string;               // Pass to DataFast email field
    name: string;                // Pass to DataFast name field
    country: string;             // ISO 3166-1 alpha-2
    created_at: string;
    updated_at: string;
  };
  subscription?: {
    id: string;                  // Present for recurring products
    object: "subscription";
    status: string;
    last_transaction_id: string;
    metadata?: Record<string, string>;
  };
  custom_fields: unknown[];
  status: "completed";
  metadata?: Record<string, string>; // <- datafast_visitor_id lives here
  mode: "local" | "test" | "sandbox";
}
```

#### `subscription.paid` payload shape

```typescript
// event.object for subscription.paid
{
  id: string;                        // "sub_6pC2lNB6joCRQIZ1aMrTpi"
  object: "subscription";
  product: {
    id: string;
    name: string;
    price: number;                   // WARNING: In cents -- divide by 100
    currency: string;
    billing_type: "recurring";
    billing_period: string;
  };
  customer: {
    id: string;
    email: string;
    name: string;
    country: string;
  };
  collection_method: "charge_automatically";
  status: "active";
  last_transaction_id: string;       // Unique per billing cycle -- use as transaction_id
  last_transaction_date: string;
  next_transaction_date: string;
  current_period_start_date: string;
  current_period_end_date: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, string>; // <- datafast_visitor_id lives here
  mode: string;
}
```

---

### 4.5 Webhook Signature Verification

> The core `creem` SDK does NOT include webhook verification helpers.
> You must implement it manually. (The `@creem_io/nextjs` wrapper exports a
> `Webhook` helper, but this integration targets the core SDK for full control.)

**Signature location:** `creem-signature` request header
**Algorithm:** HMAC-SHA256
**Key:** your webhook secret (Dashboard -> Developers -> Webhooks)
**Message:** the raw request body string (before JSON parsing)

**Exact code from Creem docs:**

```typescript
import * as crypto from 'crypto';

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function verifyCreemSignature(
  rawBody: string,   // Raw unparsed request body string
  signature: string, // Value from creem-signature header
  secret: string     // Webhook secret from Creem Dashboard
): boolean {
  if (!signature || !secret) return false;
  const computed = generateSignature(rawBody, secret);
  return computed === signature;
}
```

> CRITICAL: The signature is computed over the raw body bytes before any JSON
> parsing. If you run `express.json()` on the route before verifying, the
> signature will not match. Use `express.raw({ type: 'application/json' })`
> on the webhook route instead (see section 8.1).

**Retry schedule:**

| Attempt | Delay |
|---|---|
| 1st retry | 30 seconds |
| 2nd retry | 1 minute |
| 3rd retry | 5 minutes |
| 4th retry | 1 hour |

Manual resend available at: Dashboard -> Developers -> Webhooks -> Resend.

---

### 4.6 Client-Side Checkout URL Approach

For no-server scenarios using a static checkout link, pass the visitor ID as a
query parameter before redirecting:

```typescript
// Browser-side helper
export function appendVisitorIdToUrl(checkoutUrl: string): string {
  if (typeof document === 'undefined') return checkoutUrl;

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('datafast_visitor_id='));
  const visitorId = match?.split('=')[1];

  if (!visitorId) return checkoutUrl;

  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set('datafast_visitor_id', visitorId);
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}
```

> Preferred flow: Use a server-side checkout creation endpoint (section 4.3)
> so the cookie is read server-side and injected into Creem metadata directly.
> The client-side approach is a fallback for static/no-server setups.

---

## 5. Platform Reference: DataFast

### 5.1 Payment API — Full Spec

**Endpoint:** `POST https://datafa.st/api/v1/payments`
**Auth:** `Authorization: Bearer {DATAFAST_API_KEY}`
**Content-Type:** `application/json`

#### Required fields

| Field | Type | Description |
|---|---|---|
| `amount` | `number` | Payment amount as decimal. `29.99` for $29.99. `0` for free trials. |
| `currency` | `string` | ISO 4217 code: `"USD"`, `"EUR"`, `"GBP"` |
| `transaction_id` | `string` | Unique transaction ID from your payment provider |

#### Optional fields

| Field | Type | Description |
|---|---|---|
| `datafast_visitor_id` | `string` | Highly recommended. Visitor ID from the `datafast_visitor_id` cookie. Without this, revenue is recorded but cannot be attributed to a traffic source. |
| `email` | `string` | Customer email |
| `name` | `string` | Customer name |
| `customer_id` | `string` | Customer ID from your payment provider |
| `renewal` | `boolean` | `true` for recurring/renewal payments. Default: `false` |
| `refunded` | `boolean` | `true` if payment has been refunded. Default: `false` |
| `timestamp` | `string` | ISO 8601 payment timestamp. Defaults to now. |

#### Success Response (200 OK)

```json
{
  "message": "Payment recorded and attributed successfully",
  "transaction_id": "payment_456"
}
```

#### Error Responses

| Status | Meaning |
|---|---|
| `400` | Missing required field or malformed body |
| `401` | Missing or invalid API key |
| `500` | DataFast server error — safe to retry |

#### Canonical example (directly from DataFast docs)

```javascript
const response = await fetch("https://datafa.st/api/v1/payments", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${DATAFAST_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 29.99,
    currency: "USD",
    transaction_id: "payment_456",
    datafast_visitor_id: datafast_visitor_id, // from req.cookies.datafast_visitor_id
  }),
});
```

---

### 5.2 Attribution Flow (DataFast's Recommended Pattern)

DataFast's official recommended flow for custom payment providers:

```
1. Visitor arrives on your site
   -> DataFast script sets cookie: datafast_visitor_id=<uuid>

2. Visitor starts checkout
   -> Read cookie: req.cookies.datafast_visitor_id
   -> Pass it to your payment provider's metadata when creating a checkout session

3. Payment succeeds
   -> In your webhook handler (or success page):
      POST https://datafa.st/api/v1/payments with:
      { amount, currency, transaction_id, datafast_visitor_id }
```

This is exactly what this package automates.

---

### 5.3 Field Mapping: Creem to DataFast

#### From `checkout.completed`

| DataFast field | Creem source | Transformation |
|---|---|---|
| `amount` | `event.object.order.amount` | **Divide by 100** (Creem: cents -> DataFast: decimal) |
| `currency` | `event.object.order.currency` | Direct pass-through |
| `transaction_id` | `event.object.order.id` | Direct pass-through |
| `datafast_visitor_id` | `event.object.metadata?.datafast_visitor_id` | Direct pass-through |
| `email` | `event.object.customer.email` | Optional |
| `name` | `event.object.customer.name` | Optional |
| `customer_id` | `event.object.customer.id` | Optional |
| `renewal` | — | `false` (first payment) |

#### From `subscription.paid`

| DataFast field | Creem source | Transformation |
|---|---|---|
| `amount` | `event.object.product.price` | **Divide by 100** |
| `currency` | `event.object.product.currency` | Direct pass-through |
| `transaction_id` | `event.object.last_transaction_id` | Direct pass-through — unique per cycle |
| `datafast_visitor_id` | `event.object.metadata?.datafast_visitor_id` | Direct pass-through |
| `email` | `event.object.customer.email` | Optional |
| `name` | `event.object.customer.name` | Optional |
| `customer_id` | `event.object.customer.id` | Optional |
| `renewal` | — | **`true`** (recurring billing cycle) |

> CRITICAL: The cents-to-decimal conversion is mandatory.
> Creem stores all amounts in cents (1000 = $10.00).
> DataFast expects a decimal number (10.00 for $10.00).
> Always divide by 100.

---

## 6. Package Architecture

### 6.1 Directory Structure

```
creem-datafast/
├── src/
│   ├── index.ts                      # Main package exports
│   ├── types.ts                      # All TypeScript interfaces & types
│   ├── client.ts                     # CreemDataFastClient (checkout wrapper)
│   ├── datafast.ts                   # DataFast Payment API reporter
│   ├── webhook-handler.ts            # Framework-agnostic webhook handler
│   ├── cookie-utils.ts               # Cookie parsing (server + browser)
│   └── adapters/
│       ├── express.ts                # Express middleware
│       └── nextjs.ts                 # Next.js App Router helpers
├── example/
│   ├── express/
│   │   ├── server.ts
│   │   ├── public/index.html
│   │   └── package.json
│   └── nextjs/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── success/page.tsx
│       │   ├── components/CheckoutButton.tsx
│       │   ├── api/checkout/route.ts
│       │   └── api/webhooks/creem/route.ts
│       ├── .env.local.example
│       └── package.json
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE                           # MIT
```

---

### 6.2 Full TypeScript Type Definitions

```typescript
// src/types.ts

// ---- Package Configuration --------------------------------------------------

export interface CreemDataFastConfig {
  /** Creem API key. Prefix creem_test_ for test mode. */
  creemApiKey: string;
  /** DataFast Bearer API key */
  datafastApiKey: string;
  /** Creem webhook signing secret from Dashboard -> Developers */
  webhookSecret: string;
  /** true = test mode (test-api.creem.io), false = production (default) */
  testMode?: boolean;
}

// ---- Checkout ---------------------------------------------------------------

export interface CreateCheckoutOptions {
  productId: string;
  successUrl: string;
  /** Explicit visitor ID override. Auto-read from cookie if omitted. */
  datafastVisitorId?: string;
  /** Additional Creem metadata fields (merged with datafast_visitor_id) */
  metadata?: Record<string, string>;
  units?: number;
  discountCode?: string;
  customerEmail?: string;
}

export interface CheckoutResult {
  id: string;
  checkoutUrl: string;
  productId: string;
  status: string;
  metadata?: Record<string, string>;
  /** true if datafast_visitor_id was successfully injected */
  datafastVisitorIdInjected: boolean;
}

// ---- Creem Webhook Types ----------------------------------------------------

export type CreemEventType =
  | 'checkout.completed'
  | 'subscription.active'
  | 'subscription.paid'
  | 'subscription.canceled'
  | 'subscription.scheduled_cancel'
  | 'subscription.past_due'
  | 'subscription.expired'
  | 'subscription.trialing'
  | 'subscription.paused'
  | 'subscription.update'
  | 'refund.created'
  | 'dispute.created';

export interface CreemCustomer {
  id: string;
  object: 'customer';
  email: string;
  name: string;
  country: string;
  created_at: string;
  updated_at: string;
  mode: string;
}

export interface CreemProduct {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;           // In cents
  currency: string;
  billing_type: 'one_time' | 'recurring';
  billing_period?: string;
  status: 'active' | 'inactive';
  tax_mode: 'exclusive' | 'inclusive';
  tax_category: string;
  default_success_url: string;
  created_at: string;
  updated_at: string;
  mode: string;
}

export interface CreemOrder {
  id: string;
  customer: string;
  product: string;
  amount: number;          // In cents
  currency: string;
  status: 'paid' | 'pending' | 'refunded';
  type: 'one_time' | 'recurring';
  created_at: string;
  updated_at: string;
  mode: string;
}

export interface CreemSubscription {
  id: string;
  object: 'subscription';
  product: CreemProduct;
  customer: CreemCustomer;
  collection_method: 'charge_automatically';
  status:
    | 'active'
    | 'canceled'
    | 'past_due'
    | 'trialing'
    | 'paused'
    | 'expired'
    | 'scheduled_cancel';
  last_transaction_id?: string;
  last_transaction_date?: string;
  next_transaction_date?: string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, string>;
  mode: string;
}

export interface CreemCheckoutObject {
  id: string;
  object: 'checkout';
  request_id?: string;
  order: CreemOrder;
  product: CreemProduct;
  customer: CreemCustomer;
  subscription?: CreemSubscription;
  custom_fields: unknown[];
  status: 'completed' | 'pending' | 'expired';
  metadata?: Record<string, string>;
  mode: string;
}

export interface CreemWebhookEvent<T = unknown> {
  id: string;
  eventType: CreemEventType;
  created_at: number;
  object: T;
}

export type CheckoutCompletedEvent = CreemWebhookEvent<CreemCheckoutObject>;
export type SubscriptionPaidEvent  = CreemWebhookEvent<CreemSubscription>;

// ---- DataFast ---------------------------------------------------------------

/** Full DataFast Payment API request body — all confirmed fields */
export interface DataFastPaymentPayload {
  /** Decimal amount. 29.99 for $29.99. NOT cents. */
  amount: number;
  /** ISO 4217: "USD", "EUR", "GBP" */
  currency: string;
  /** Unique transaction ID from payment provider */
  transaction_id: string;
  /** Highly recommended. Visitor ID from datafast_visitor_id cookie. */
  datafast_visitor_id?: string;
  email?: string;
  name?: string;
  /** Customer ID from payment provider */
  customer_id?: string;
  /** true for recurring/renewal payments. Default: false */
  renewal?: boolean;
  /** true if payment has been refunded. Default: false */
  refunded?: boolean;
  /** ISO 8601 timestamp. Defaults to now. */
  timestamp?: string;
}

/** Response from POST /api/v1/payments (200 OK) */
export interface DataFastPaymentResponse {
  message: string;         // "Payment recorded and attributed successfully"
  transaction_id: string;
}

export interface DataFastReportResult {
  success: boolean;
  transactionId: string;
  datafastVisitorId?: string;
  error?: string;
}

// ---- Webhook Handler --------------------------------------------------------

export interface WebhookHandlerOptions {
  onCheckoutCompleted?: (
    event: CheckoutCompletedEvent,
    datafastResult: DataFastReportResult
  ) => Promise<void> | void;
  onSubscriptionPaid?: (
    event: SubscriptionPaidEvent,
    datafastResult: DataFastReportResult
  ) => Promise<void> | void;
  onOtherEvent?: (event: CreemWebhookEvent) => Promise<void> | void;
  onError?: (error: Error, rawBody: string) => void;
}

export interface ParsedWebhookRequest {
  rawBody: string;
  signature: string;
}
```

---

## 7. Core Implementation

### 7.1 Cookie Utilities

```typescript
// src/cookie-utils.ts
import { IncomingMessage } from 'http';

export function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(';')
    .reduce<Record<string, string>>((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return acc;
      const key = pair.slice(0, idx).trim();
      const val = decodeURIComponent(pair.slice(idx + 1).trim());
      acc[key] = val;
      return acc;
    }, {});
}

/** Read a named cookie from a Node.js IncomingMessage. */
export function readCookieFromRequest(
  req: IncomingMessage,
  cookieName: string
): string | undefined {
  return parseCookies(req.headers['cookie'] ?? '')[cookieName];
}

/** Convenience: read datafast_visitor_id from any Node.js request. */
export function readDataFastVisitorId(req: IncomingMessage): string | undefined {
  return readCookieFromRequest(req, 'datafast_visitor_id');
}

// ---- Browser helpers --------------------------------------------------------

/** Read datafast_visitor_id from document.cookie (browser only). */
export function readDataFastVisitorIdFromBrowser(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('datafast_visitor_id='));
  return match?.split('=')[1];
}

/**
 * Append datafast_visitor_id to a Creem checkout URL.
 * Fallback for client-side redirect flows with no server.
 */
export function appendVisitorIdToCheckoutUrl(checkoutUrl: string): string {
  const visitorId = readDataFastVisitorIdFromBrowser();
  if (!visitorId) return checkoutUrl;
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set('datafast_visitor_id', visitorId);
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}
```

---

### 7.2 CreemDataFast Client

```typescript
// src/client.ts
import { Creem } from 'creem';
import { IncomingMessage } from 'http';
import { readDataFastVisitorId } from './cookie-utils';
import type {
  CreemDataFastConfig,
  CreateCheckoutOptions,
  CheckoutResult,
} from './types';

export class CreemDataFastClient {
  private creem: Creem;

  constructor(private config: CreemDataFastConfig) {
    this.creem = new Creem({
      apiKey: config.creemApiKey,
      serverIdx: config.testMode ? 1 : 0,
    });
  }

  /**
   * Create a Creem checkout session with datafast_visitor_id
   * automatically injected into metadata.
   *
   * Visitor ID resolution order:
   *   1. options.datafastVisitorId  (explicit override)
   *   2. datafast_visitor_id cookie from the incoming request
   *   3. Omitted — checkout created without attribution
   */
  async createCheckout(
    req: IncomingMessage,
    options: CreateCheckoutOptions
  ): Promise<CheckoutResult> {
    const visitorId =
      options.datafastVisitorId ?? readDataFastVisitorId(req);

    const metadata: Record<string, string> = { ...options.metadata };
    if (visitorId) {
      metadata['datafast_visitor_id'] = visitorId;
    }

    try {
      const checkout = await this.creem.checkouts.create({
        productId:  options.productId,
        successUrl: options.successUrl,
        ...(options.units !== undefined ? { units: options.units } : {}),
        ...(options.discountCode ? { discountCode: options.discountCode } : {}),
        ...(options.customerEmail
          ? { customer: { email: options.customerEmail } }
          : {}),
        metadata,
      });

      return {
        id: checkout.id,
        checkoutUrl: checkout.checkoutUrl, // SDK: snake_case -> camelCase
        productId: options.productId,
        status: checkout.status ?? 'pending',
        metadata,
        datafastVisitorIdInjected: Boolean(visitorId),
      };
    } catch (error) {
      throw new Error(
        `Creem checkout creation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
```

---

### 7.3 DataFast Reporter

```typescript
// src/datafast.ts
import type {
  CheckoutCompletedEvent,
  SubscriptionPaidEvent,
  DataFastPaymentPayload,
  DataFastReportResult,
  DataFastPaymentResponse,
} from './types';

const DATAFAST_PAYMENTS_URL = 'https://datafa.st/api/v1/payments';

export class DataFastReporter {
  constructor(private apiKey: string) {}

  /**
   * Map checkout.completed -> DataFast Payment API.
   * renewal: false (first/one-time payment).
   */
  async reportCheckoutCompleted(
    event: CheckoutCompletedEvent
  ): Promise<DataFastReportResult> {
    const { order, customer, metadata } = event.object;

    return this.report({
      amount: order.amount / 100,        // CRITICAL: Creem cents -> DataFast decimal
      currency: order.currency,
      transaction_id: order.id,
      datafast_visitor_id: metadata?.['datafast_visitor_id'],
      email: customer.email,
      name: customer.name,
      customer_id: customer.id,
      renewal: false,
    });
  }

  /**
   * Map subscription.paid -> DataFast Payment API.
   * Uses last_transaction_id (unique per billing cycle).
   * renewal: true (recurring payment).
   */
  async reportSubscriptionPaid(
    event: SubscriptionPaidEvent
  ): Promise<DataFastReportResult> {
    const sub = event.object;

    return this.report({
      amount: sub.product.price / 100,   // CRITICAL: Creem cents -> DataFast decimal
      currency: sub.product.currency,
      transaction_id: sub.last_transaction_id ?? sub.id,
      datafast_visitor_id: sub.metadata?.['datafast_visitor_id'],
      email: sub.customer.email,
      name: sub.customer.name,
      customer_id: sub.customer.id,
      renewal: true,
    });
  }

  /**
   * POST to DataFast Payment API.
   *
   * Never throws. Returns { success: false, error } on failure so the webhook
   * handler always returns 200 OK to Creem (preventing retries) even if
   * DataFast reporting fails.
   */
  async report(payload: DataFastPaymentPayload): Promise<DataFastReportResult> {
    const result: DataFastReportResult = {
      success: false,
      transactionId: payload.transaction_id,
      datafastVisitorId: payload.datafast_visitor_id,
    };

    // Strip undefined fields
    const body = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );

    try {
      const response = await fetch(DATAFAST_PAYMENTS_URL, {
        method: 'POST',
        headers: {
          Authorization:   `Bearer ${this.apiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        result.error = `DataFast HTTP ${response.status}: ${text}`;
        return result;
      }

      await response.json() as DataFastPaymentResponse;
      result.success = true;
      return result;
    } catch (err) {
      result.error = `DataFast network error: ${
        err instanceof Error ? err.message : String(err)
      }`;
      return result;
    }
  }
}
```

---

### 7.4 Generic Webhook Handler

```typescript
// src/webhook-handler.ts
import * as crypto from 'crypto';
import { DataFastReporter } from './datafast';
import type {
  CreemWebhookEvent,
  CheckoutCompletedEvent,
  SubscriptionPaidEvent,
  WebhookHandlerOptions,
  ParsedWebhookRequest,
} from './types';

export class CreemWebhookHandler {
  private reporter: DataFastReporter;

  constructor(
    private webhookSecret: string,
    datafastApiKey: string,
    private options: WebhookHandlerOptions = {}
  ) {
    this.reporter = new DataFastReporter(datafastApiKey);
  }

  /**
   * Verify the Creem HMAC-SHA256 signature.
   * Exact implementation from Creem docs.
   * rawBody must be the unparsed request body string.
   */
  verifySignature(rawBody: string, signature: string): boolean {
    if (!signature || !this.webhookSecret) return false;
    const computed = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return computed === signature;
  }

  /**
   * Process a Creem webhook request end-to-end:
   *   1. Verify HMAC-SHA256 signature
   *   2. Parse the event
   *   3. Report to DataFast (checkout.completed / subscription.paid)
   *   4. Fire user callback
   *
   * Throws on signature failure or parse error.
   * DataFast errors do NOT throw — surfaced via DataFastReportResult.
   */
  async handle({ rawBody, signature }: ParsedWebhookRequest): Promise<void> {
    if (!this.verifySignature(rawBody, signature)) {
      const err = new Error('Invalid Creem webhook signature');
      this.options.onError?.(err, rawBody);
      throw err;
    }

    let event: CreemWebhookEvent;
    try {
      event = JSON.parse(rawBody) as CreemWebhookEvent;
    } catch (parseError) {
      const err = new Error(`Webhook body parse error: ${parseError}`);
      this.options.onError?.(err, rawBody);
      throw err;
    }

    switch (event.eventType) {
      case 'checkout.completed': {
        const typed  = event as CheckoutCompletedEvent;
        const result = await this.reporter.reportCheckoutCompleted(typed);
        await this.options.onCheckoutCompleted?.(typed, result);
        break;
      }
      case 'subscription.paid': {
        const typed  = event as SubscriptionPaidEvent;
        const result = await this.reporter.reportSubscriptionPaid(typed);
        await this.options.onSubscriptionPaid?.(typed, result);
        break;
      }
      default:
        await this.options.onOtherEvent?.(event);
        break;
    }
  }
}
```

---

### 7.5 Package Entry Point

```typescript
// src/index.ts
export { CreemDataFastClient }  from './client';
export { CreemWebhookHandler }  from './webhook-handler';
export { DataFastReporter }     from './datafast';
export {
  readCookieFromRequest,
  readDataFastVisitorId,
  readDataFastVisitorIdFromBrowser,
  appendVisitorIdToCheckoutUrl,
  parseCookies,
} from './cookie-utils';

export type {
  CreemDataFastConfig,
  CreateCheckoutOptions,
  CheckoutResult,
  CreemEventType,
  CreemWebhookEvent,
  CheckoutCompletedEvent,
  SubscriptionPaidEvent,
  CreemCheckoutObject,
  CreemSubscription,
  CreemOrder,
  CreemCustomer,
  CreemProduct,
  DataFastPaymentPayload,
  DataFastPaymentResponse,
  DataFastReportResult,
  WebhookHandlerOptions,
  ParsedWebhookRequest,
} from './types';
```

---

## 8. Framework Adapters

### 8.1 Express Middleware

```typescript
// src/adapters/express.ts
import type { Request, Response, NextFunction } from 'express';
import { CreemWebhookHandler } from '../webhook-handler';
import type { WebhookHandlerOptions } from '../types';

export interface ExpressWebhookOptions extends WebhookHandlerOptions {
  webhookSecret: string;
  datafastApiKey: string;
}

/**
 * Express middleware for Creem webhooks with automatic DataFast reporting.
 *
 * IMPORTANT: Mount express.raw({ type: 'application/json' }) BEFORE this
 * middleware on the webhook route. express.json() pre-parses the body and
 * breaks HMAC-SHA256 signature verification.
 *
 * @example
 *   app.post(
 *     '/api/webhooks/creem',
 *     express.raw({ type: 'application/json' }),  // <- required first
 *     creemWebhookMiddleware({
 *       webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
 *       datafastApiKey: process.env.DATAFAST_API_KEY!,
 *       onCheckoutCompleted: async (event, result) => {
 *         await db.grantAccess(event.object.customer.email);
 *       },
 *     })
 *   );
 */
export function creemWebhookMiddleware(options: ExpressWebhookOptions) {
  const handler = new CreemWebhookHandler(
    options.webhookSecret,
    options.datafastApiKey,
    options
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    const signature = (req.headers['creem-signature'] ?? '') as string;

    // express.raw() gives a Buffer -- convert to string for HMAC
    const rawBody =
      Buffer.isBuffer(req.body)
        ? req.body.toString('utf-8')
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    try {
      await handler.handle({ rawBody, signature });
      res.status(200).json({ received: true });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('signature')) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      next(error);
    }
  };
}
```

---

### 8.2 Next.js App Router Helper

```typescript
// src/adapters/nextjs.ts
import { NextRequest, NextResponse } from 'next/server';
import { IncomingMessage } from 'http';
import { CreemWebhookHandler } from '../webhook-handler';
import { CreemDataFastClient } from '../client';
import type { WebhookHandlerOptions, CreateCheckoutOptions } from '../types';

// ---- Webhook Route ----------------------------------------------------------

export interface NextJsWebhookOptions extends WebhookHandlerOptions {
  webhookSecret: string;
  datafastApiKey: string;
}

/**
 * Next.js App Router POST handler for Creem webhooks.
 * Uses req.text() to get the raw body before any parsing.
 *
 * @example
 *   // app/api/webhooks/creem/route.ts
 *   import { creemWebhookHandler } from 'creem-datafast/nextjs';
 *
 *   export const POST = creemWebhookHandler({
 *     webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
 *     datafastApiKey: process.env.DATAFAST_API_KEY!,
 *     onCheckoutCompleted: async (event, result) => {
 *       await db.orders.create({ creemOrderId: event.object.order.id });
 *     },
 *   });
 */
export function creemWebhookHandler(options: NextJsWebhookOptions) {
  const handler = new CreemWebhookHandler(
    options.webhookSecret,
    options.datafastApiKey,
    options
  );

  return async function POST(req: NextRequest): Promise<NextResponse> {
    const signature = req.headers.get('creem-signature') ?? '';
    const rawBody   = await req.text(); // raw string for HMAC verification

    try {
      await handler.handle({ rawBody, signature });
      return NextResponse.json({ received: true }, { status: 200 });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('signature')) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// ---- Checkout Route ---------------------------------------------------------

export interface NextJsCheckoutConfig {
  creemApiKey: string;
  testMode?: boolean;
}

/**
 * Next.js App Router POST handler factory for creating Creem checkouts.
 * Reads datafast_visitor_id from the request Cookie header automatically.
 *
 * @example
 *   // app/api/checkout/route.ts
 *   import { creemCheckoutHandler } from 'creem-datafast/nextjs';
 *
 *   const handler = creemCheckoutHandler({ creemApiKey: process.env.CREEM_API_KEY! });
 *
 *   export async function POST(req: NextRequest) {
 *     return handler(req, {
 *       productId:  process.env.CREEM_PRODUCT_ID!,
 *       successUrl: `${process.env.NEXT_PUBLIC_URL}/success`,
 *     });
 *   }
 */
export function creemCheckoutHandler(config: NextJsCheckoutConfig) {
  const client = new CreemDataFastClient({
    creemApiKey:    config.creemApiKey,
    datafastApiKey: '',
    webhookSecret:  '',
    testMode:       config.testMode,
  });

  return async function handler(
    req: NextRequest,
    options: CreateCheckoutOptions
  ): Promise<NextResponse> {
    // Bridge NextRequest -> IncomingMessage interface for cookie reading
    const fakeReq = {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    } as unknown as IncomingMessage;

    try {
      const checkout = await client.createCheckout(fakeReq, options);
      return NextResponse.json(checkout);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Checkout failed' },
        { status: 500 }
      );
    }
  };
}
```

---

## 9. Quickstart: Express

### Install

```bash
npm install creem-datafast express dotenv
npm install -D @types/express typescript ts-node
```

### `.env`

```bash
CREEM_API_KEY=creem_test_xxxxxxxxxxxxxxxxxxxx
CREEM_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
CREEM_PRODUCT_ID=prod_xxxxxxxxxxxxxxxxxxxx
DATAFAST_API_KEY=df_xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_DATAFAST_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PORT=3000
```

### `server.ts`

```typescript
import 'dotenv/config';
import express from 'express';
import { CreemDataFastClient } from 'creem-datafast';
import { creemWebhookMiddleware } from 'creem-datafast/express';

const app = express();
app.use(express.json()); // Global JSON parsing -- does NOT apply to webhook route

// ---- Checkout ---------------------------------------------------------------

const creemClient = new CreemDataFastClient({
  creemApiKey:    process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret:  process.env.CREEM_WEBHOOK_SECRET!,
  testMode:       process.env.NODE_ENV !== 'production',
});

app.post('/api/checkout', async (req, res) => {
  try {
    const checkout = await creemClient.createCheckout(req, {
      productId:  process.env.CREEM_PRODUCT_ID!,
      successUrl: `http://localhost:${process.env.PORT}/success`,
    });

    console.log(`Checkout created. Attribution: ${checkout.datafastVisitorIdInjected}`);
    res.json({ checkoutUrl: checkout.checkoutUrl });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Could not create checkout' });
  }
});

// ---- Success Page -----------------------------------------------------------

app.get('/success', (req, res) => {
  const { order_id } = req.query;
  res.send(`<h1>Payment successful!</h1><p>Order: ${order_id}</p>`);
});

// ---- Webhooks ---------------------------------------------------------------
// express.raw() MUST come before creemWebhookMiddleware

app.post(
  '/api/webhooks/creem',
  express.raw({ type: 'application/json' }),
  creemWebhookMiddleware({
    webhookSecret:  process.env.CREEM_WEBHOOK_SECRET!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,

    onCheckoutCompleted: async (event, datafastResult) => {
      const { customer, order } = event.object;
      console.log(`Payment: ${customer.email} -> ${order.amount / 100} ${order.currency}`);
      console.log(`DataFast attributed: ${datafastResult.success}`);
      console.log(`Visitor: ${datafastResult.datafastVisitorId ?? 'not captured'}`);

      if (!datafastResult.success) {
        console.warn('DataFast error:', datafastResult.error);
      }

      // Always grant access regardless of attribution outcome
      // await db.users.grantAccess(customer.email);
    },

    onSubscriptionPaid: async (event, datafastResult) => {
      console.log(`Renewal: ${event.object.last_transaction_id}`);
      console.log(`Renewal attributed: ${datafastResult.success}`);
    },

    onOtherEvent: async (event) => {
      console.log(`Creem event: ${event.eventType}`);
    },

    onError: (err) => {
      console.error('Webhook error:', err.message);
    },
  })
);

// ---- Landing Page -----------------------------------------------------------

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html><html><head><title>My SaaS</title></head><body>
      <script
        defer
        data-website-id="${process.env.NEXT_PUBLIC_DATAFAST_ID}"
        src="https://datafa.st/js/script.js"
      ></script>
      <h1>My SaaS</h1>
      <button id="btn">Buy Now</button>
      <script>
        document.getElementById('btn').addEventListener('click', async () => {
          const res = await fetch('/api/checkout', { method: 'POST' });
          const { checkoutUrl } = await res.json();
          window.location.href = checkoutUrl;
        });
      </script>
    </body></html>
  `);
});

app.listen(process.env.PORT, () => {
  console.log(`Server -> http://localhost:${process.env.PORT}`);
});
```

---

## 10. Quickstart: Next.js

### Install

```bash
npm install creem-datafast creem
```

### `.env.local`

```bash
CREEM_API_KEY=creem_test_xxxxxxxxxxxxxxxxxxxx
CREEM_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
CREEM_PRODUCT_ID=prod_xxxxxxxxxxxxxxxxxxxx
DATAFAST_API_KEY=df_xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_DATAFAST_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_URL=http://localhost:3000
```

### `app/api/webhooks/creem/route.ts`

```typescript
import { creemWebhookHandler } from 'creem-datafast/nextjs';

export const POST = creemWebhookHandler({
  webhookSecret:  process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,

  onCheckoutCompleted: async (event, datafastResult) => {
    const { customer, order } = event.object;
    console.log(`${customer.email} -> ${order.amount / 100} ${order.currency}`);
    console.log(`Attributed to visitor: ${datafastResult.datafastVisitorId}`);

    if (!datafastResult.success) {
      console.warn('DataFast miss:', datafastResult.error);
    }

    // await db.subscriptions.activate(customer.email);
  },

  onSubscriptionPaid: async (_event, datafastResult) => {
    console.log(`Renewal tracked. Success: ${datafastResult.success}`);
  },
});
```

### `app/api/checkout/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { creemCheckoutHandler } from 'creem-datafast/nextjs';

const handler = creemCheckoutHandler({
  creemApiKey: process.env.CREEM_API_KEY!,
  testMode:    process.env.NODE_ENV !== 'production',
});

export async function POST(req: NextRequest) {
  return handler(req, {
    productId:  process.env.CREEM_PRODUCT_ID!,
    successUrl: `${process.env.NEXT_PUBLIC_URL}/success`,
  });
}
```

### `app/page.tsx`

```tsx
import Script from 'next/script';
import { CheckoutButton } from './components/CheckoutButton';

export default function Page() {
  return (
    <main>
      <Script
        defer
        data-website-id={process.env.NEXT_PUBLIC_DATAFAST_ID}
        src="https://datafa.st/js/script.js"
      />
      <h1>My SaaS</h1>
      <CheckoutButton />
    </main>
  );
}
```

### `app/components/CheckoutButton.tsx`

```tsx
'use client';

export function CheckoutButton() {
  async function handleClick() {
    const res = await fetch('/api/checkout', { method: 'POST' });
    const { checkoutUrl, error } = await res.json();
    if (error) { alert('Checkout failed'); return; }
    window.location.href = checkoutUrl;
  }

  return <button onClick={handleClick}>Get Started</button>;
}
```

### `app/success/page.tsx`

```tsx
export default function SuccessPage({
  searchParams,
}: {
  searchParams: { order_id?: string; customer_id?: string };
}) {
  return (
    <main>
      <h1>Payment successful!</h1>
      <p>Order: <code>{searchParams.order_id}</code></p>
      <p>Revenue attributed in DataFast.</p>
    </main>
  );
}
```

---

## 11. End-to-End Flow Walkthrough

```
(1) Visitor lands on yoursite.com
    -> DataFast script runs
    -> Sets cookie: datafast_visitor_id=3cff4252-fa96-4gec-8b1b-bs695e763b65
       (this is the exact example value from the DataFast docs)
    -> Tracks UTM source, referrer, device

(2) Visitor clicks "Buy Now"
    -> Browser POSTs to /api/checkout
    -> Cookie header sent automatically:
       datafast_visitor_id=3cff4252-fa96-4gec-8b1b-bs695e763b65

(3) Server: CreemDataFastClient.createCheckout(req, { productId })
    -> readDataFastVisitorId(req) = "3cff4252-fa96-4gec-8b1b-bs695e763b65"
    -> creem.checkouts.create({
         productId: "prod_xxx",
         successUrl: "https://yoursite.com/success",
         metadata: {
           datafast_visitor_id: "3cff4252-fa96-4gec-8b1b-bs695e763b65"
         }
       })
    -> SDK returns { checkoutUrl: "https://checkout.creem.io/ch_xxx" }
    -> datafastVisitorIdInjected: true

(4) Browser redirects to Creem-hosted checkout page

(5) Customer fills payment details and submits
    -> Creem processes payment

(6) Creem fires POST to https://yoursite.com/api/webhooks/creem
    Headers: { "creem-signature": "dd7bdd2cf1f6bac6..." }
    Body: {
      id: "evt_5WHHcZPv7VS0YUsberIuOz",
      eventType: "checkout.completed",
      created_at: 1728734325927,
      object: {
        order: { id: "ord_xxx", amount: 2999, currency: "USD" },
        customer: { email: "user@email.com", name: "John Doe" },
        metadata: {
          datafast_visitor_id: "3cff4252-fa96-4gec-8b1b-bs695e763b65"
        }
      }
    }

(7) verifySignature(rawBody, "dd7bdd2cf1f6bac6...", webhookSecret) -> true

(8) DataFastReporter.reportCheckoutCompleted() maps:
    amount:               29.99     <- 2999 / 100 (cents to decimal)
    currency:             "USD"
    transaction_id:       "ord_xxx"
    datafast_visitor_id:  "3cff4252-fa96-4gec-8b1b-bs695e763b65"
    email:                "user@email.com"
    name:                 "John Doe"
    renewal:              false

    POST https://datafa.st/api/v1/payments
    Authorization: Bearer {DATAFAST_API_KEY}

    Response 200 OK:
    { "message": "Payment recorded and attributed successfully",
      "transaction_id": "ord_xxx" }

(9) onCheckoutCompleted callback fires
    -> Your code grants product access

(10) Webhook handler returns 200 OK to Creem
     -> No retries triggered
```

---

## 12. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `CREEM_API_KEY` | Yes | Creem API key. Prefix `creem_test_` for test mode. |
| `CREEM_WEBHOOK_SECRET` | Yes | Webhook signing secret — Dashboard -> Developers -> Webhooks |
| `CREEM_PRODUCT_ID` | Yes | Creem product ID to checkout against |
| `DATAFAST_API_KEY` | Yes | DataFast Bearer API key — DataFast Dashboard -> Settings |
| `NEXT_PUBLIC_DATAFAST_ID` | Yes | DataFast website ID for the tracking script tag |
| `NEXT_PUBLIC_URL` | Next.js | Base URL for constructing successUrl |
| `PORT` | Express | Server port (default: 3000) |
| `NODE_ENV` | Optional | Set to `production` to use Creem production API (serverIdx: 0) |
| `CREEM_DEBUG` | Optional | Set to `true` for Creem SDK debug logging |

---

## 13. Error Handling & Idempotency

### Webhook Retries

Creem retries on non-2xx responses with the schedule: 30s -> 1m -> 5m -> 1h.
The handler always returns 200 OK — even if DataFast reporting fails — to prevent
retry storms from triggering duplicate access grants.

### Idempotency

Your callbacks may be called more than once for the same event due to retries.
Always guard with the transaction ID:

```typescript
onCheckoutCompleted: async (event, datafastResult) => {
  const orderId = event.object.order.id; // "ord_xxx" -- stable unique ID

  const exists = await db.orders.findOne({ where: { creemOrderId: orderId } });
  if (exists) {
    console.log(`Duplicate event for ${orderId} -- skipping`);
    return;
  }

  await db.orders.create({ creemOrderId: orderId, /* ... */ });
  await grantProductAccess(event.object.customer.email);
},

onSubscriptionPaid: async (event, datafastResult) => {
  const txId = event.object.last_transaction_id; // Unique per billing cycle

  const exists = await db.renewals.findOne({ where: { txId } });
  if (exists) return;

  await db.renewals.create({ txId, /* ... */ });
},
```

### DataFast Reporting Failures

`DataFastReporter.report()` never throws. Failures return
`{ success: false, error: string }`. Product access is always granted
regardless of attribution outcome:

```typescript
onCheckoutCompleted: async (event, datafastResult) => {
  if (!datafastResult.success) {
    // Log for investigation -- don't block access granting
    await logger.error('datafast_attribution_miss', {
      transactionId: datafastResult.transactionId,
      visitorId:     datafastResult.datafastVisitorId,
      error:         datafastResult.error,
    });
  }

  // Always grant -- never condition on attribution
  await grantProductAccess(event.object.customer.email);
},
```

---

## 14. Testing Locally

### Step 1 — Test Mode

Set `CREEM_API_KEY=creem_test_xxx` and `testMode: true`. No real charges.
The SDK uses `test-api.creem.io` (serverIdx: 1).

### Step 2 — Expose Localhost

```bash
# ngrok
ngrok http 3000
# Register: https://8733-xxx.ngrok.io/api/webhooks/creem
# in Creem Dashboard -> Developers -> Webhooks
```

### Step 3 — Run the Full Flow

1. Visit `http://localhost:3000` so the DataFast cookie is set
2. Click the checkout button and verify `datafastVisitorIdInjected: true` in logs
3. Complete a test payment on the Creem checkout page
4. Verify the webhook fires and DataFast reports successfully
5. Check DataFast dashboard for the attributed payment

### Step 4 — Unit Test the Reporter

```typescript
// __tests__/datafast.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DataFastReporter } from '../src/datafast';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DataFastReporter', () => {
  let reporter: DataFastReporter;

  beforeEach(() => {
    reporter = new DataFastReporter('test-key');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: 'Payment recorded and attributed successfully',
        transaction_id: 'ord_test',
      }),
    });
  });

  it('divides Creem cents by 100 for DataFast decimal format', async () => {
    const result = await reporter.report({
      amount: 29.99,      // already converted by reportCheckoutCompleted
      currency: 'USD',
      transaction_id: 'ord_test',
      datafast_visitor_id: 'abc-123',
      renewal: false,
    });

    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.amount).toBe(29.99);
    expect(body.renewal).toBe(false);
    expect(body.datafast_visitor_id).toBe('abc-123');
  });

  it('sets renewal: true for subscription.paid', async () => {
    const result = await reporter.report({
      amount: 9.99,
      currency: 'USD',
      transaction_id: 'tran_test',
      renewal: true,
    });

    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.renewal).toBe(true);
  });

  it('returns success: false without throwing on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const result = await reporter.report({
      amount: 10,
      currency: 'USD',
      transaction_id: 'txn_test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });
});
```

---

## 15. package.json & tsconfig.json

### `package.json`

```json
{
  "name": "creem-datafast",
  "version": "1.0.0",
  "description": "Automatic DataFast revenue attribution for Creem payments",
  "license": "MIT",
  "main":   "./dist/index.js",
  "module": "./dist/index.mjs",
  "types":  "./dist/index.d.ts",
  "exports": {
    ".": {
      "import":  "./dist/index.mjs",
      "require": "./dist/index.js",
      "types":   "./dist/index.d.ts"
    },
    "./express": {
      "import":  "./dist/adapters/express.mjs",
      "require": "./dist/adapters/express.js",
      "types":   "./dist/adapters/express.d.ts"
    },
    "./nextjs": {
      "import":  "./dist/adapters/nextjs.mjs",
      "require": "./dist/adapters/nextjs.js",
      "types":   "./dist/adapters/nextjs.d.ts"
    }
  },
  "scripts": {
    "build":     "tsup src/index.ts src/adapters/express.ts src/adapters/nextjs.ts --format cjs,esm --dts",
    "dev":       "tsup --watch",
    "test":      "vitest run",
    "typecheck": "tsc --noEmit",
    "lint":      "eslint src --ext .ts"
  },
  "dependencies": {
    "creem": "^1.0.0"
  },
  "peerDependencies": {
    "express": ">=4.0.0",
    "next":    ">=13.0.0"
  },
  "peerDependenciesMeta": {
    "express": { "optional": true },
    "next":    { "optional": true }
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node":    "^20.0.0",
    "express":        "^4.18.0",
    "next":           "^14.0.0",
    "tsup":           "^8.0.0",
    "typescript":     "^5.0.0",
    "vitest":         "^1.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target":                           "ES2020",
    "module":                           "ESNext",
    "moduleResolution":                 "Bundler",
    "lib":                              ["ES2020", "DOM"],
    "outDir":                           "./dist",
    "rootDir":                          "./src",
    "strict":                           true,
    "exactOptionalPropertyTypes":       true,
    "noUncheckedIndexedAccess":         true,
    "declaration":                      true,
    "declarationMap":                   true,
    "sourceMap":                        true,
    "esModuleInterop":                  true,
    "skipLibCheck":                     true,
    "forceConsistentCasingInFileNames": true
  },
  "include":  ["src/**/*"],
  "exclude":  ["node_modules", "dist", "example"]
}
```

---

## Quick Reference Card

```
+------------------------------------------------------------------------+
|               CREEM x DATAFAST -- GROUND TRUTH CHEATSHEET              |
+------------------------------------------------------------------------+
| CREEM SDK                                                              |
|   npm install creem  (NOT creem_io)                                    |
|   import { Creem } from 'creem'                                        |
|   new Creem({ apiKey, serverIdx: 1 })  <- 1 = test mode               |
|   creem.checkouts.create({ productId, metadata })                      |
|   checkout.checkoutUrl  <- SDK auto-converts snake_case to camelCase   |
|   CREEM_DEBUG=true  <- enable SDK debug logs                           |
|   No webhook helpers in core SDK -- implement manually                 |
|   Tree-shakable: import { CreemCore } from 'creem/core.js'             |
|   Type imports: from 'creem/models/components'                         |
|                                                                        |
| CREEM WEBHOOKS                                                         |
|   Signature header:  creem-signature                                   |
|   Algorithm:         HMAC-SHA256(webhookSecret, rawBody) -> hex        |
|   Revenue events:    checkout.completed  subscription.paid             |
|   Other events:      12 total (see section 4.4)                        |
|   Retries:           30s -> 1m -> 5m -> 1hr                            |
|   Required response: HTTP 200 OK                                       |
|   metadata field echoed in ALL webhook events <- key for attribution   |
|   Use subscription.paid (not .active) to grant access                 |
|                                                                        |
| DATAFAST PAYMENT API                                                   |
|   Endpoint:  POST https://datafa.st/api/v1/payments                   |
|   Auth:      Authorization: Bearer {DATAFAST_API_KEY}                  |
|   Required:  amount (DECIMAL)  currency  transaction_id               |
|   Key:       datafast_visitor_id  <- attribution lives here            |
|   Optional:  email  name  customer_id  renewal  refunded  timestamp    |
|   renewal:   false = first payment | true = recurring cycle            |
|   Success:   200 { message: "...", transaction_id: "..." }             |
|                                                                        |
|   CRITICAL: CENTS -> DECIMAL CONVERSION                                |
|   Creem amount:    2999  (stored as cents)                             |
|   DataFast amount: 29.99 (expects decimal)  <- always divide by 100   |
|                                                                        |
| COOKIE                                                                 |
|   Name:       datafast_visitor_id                                      |
|   Read:       req.headers['cookie'] (server-side)                      |
|   Inject at:  creem.checkouts.create({ metadata: { ... } })           |
|   Echoed in:  every Creem webhook event for that checkout              |
+------------------------------------------------------------------------+
```

---

*All content verified directly from source documentation.*
*docs.creem.io | docs.creem.io/code/sdks/typescript-core | docs.creem.io/code/webhooks*
*datafa.st/docs/payments-api | datafa.st/docs/api-create-payment*
*March 2026*
