# Examples

These examples are intended for local verification with real credentials.

## Next.js example

Path: `examples/nextjs`

- Uses `createCheckout(..., { request })` so server-side cookie capture works automatically.
- Also supports an optional JSON body with `visitorId` for explicit client-side handoff.
- Webhook route uses `createNextWebhookHandler` from `creem-datafast-integration/next`.

Run:

```bash
cd examples/nextjs
npm install
npm run dev
```

## Express example

Path: `examples/express`

- Checkout route uses `createCheckout(..., { request: { headers, url } })`.
- Webhook route uses `express.raw({ type: 'application/json' })` plus `createExpressWebhookHandler`.

Run:

```bash
cd examples/express
npm install
npm run dev
```

## Required environment variables

- `CREEM_API_KEY`
- `CREEM_PRODUCT_ID`
- `CREEM_WEBHOOK_SECRET`
- `DATAFAST_API_KEY`
