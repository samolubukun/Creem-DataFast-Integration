import express from 'express';
import { config } from 'dotenv';
import { createCreemDataFastClient, creemDataFastWebhook, getVisitorIdFromUrl } from 'creem-datafast-integration';

config();

const app = express();

const CREEM_API_KEY = process.env.CREEM_API_KEY!;
const DATAFAST_API_KEY = process.env.DATAFAST_API_KEY!;
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;

const creemClient = createCreemDataFastClient({
  apiKey: CREEM_API_KEY,
});

// ---------- Landing page ----------

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CREEM + DataFast Integration Example</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 30px; border-radius: 8px; }
        button { background: #0066cc; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0052a3; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .tip  { background: #fff8e1; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 14px; }
      </style>
      <!-- DataFast tracking script — sets the datafast_visitor_id cookie -->
      <script async defer src="https://cdn.datafa.st/tracking.js"></script>
    </head>
    <body>
      <div class="container">
        <h1>CREEM + DataFast Integration</h1>
        <p>This example demonstrates automatic revenue attribution between CREEM and DataFast.</p>

        <div class="info">
          <strong>How it works (server-side cookie pattern):</strong>
          <ul>
            <li>DataFast tracking script sets the <code>datafast_visitor_id</code> cookie</li>
            <li>The server reads the cookie automatically from the HTTP request — no JS required</li>
            <li>The visitor ID is injected into CREEM checkout metadata server-side</li>
            <li>When CREEM sends a webhook, payment data + visitor ID are forwarded to DataFast</li>
          </ul>
        </div>

        <div class="tip">
          <strong>Alternative (manual pattern):</strong>
          The form below also sends the visitor ID explicitly from the browser — useful when
          you need the ID before the cookie has been set (e.g. from a URL query param).
        </div>

        <!-- Pattern A: simple form POST — server reads cookie automatically -->
        <form action="/api/create-checkout" method="POST" style="display:inline">
          <input type="hidden" name="productId" value="${process.env.CREEM_PRODUCT_ID || 'prod_example'}" />
          <button type="submit">Buy Now - $29.99 (server-side cookie)</button>
        </form>

        &nbsp;

        <!-- Pattern B: JS reads cookie/URL param and sends it in the body -->
        <button onclick="startCheckoutManual()">Buy Now - $29.99 (manual visitor ID)</button>

        <p><small>Product: Premium Plan</small></p>
      </div>

      <script>
        async function startCheckoutManual() {
          // Use getVisitorIdFromUrl or read the cookie manually as fallback
          const urlId = new URLSearchParams(window.location.search).get('datafast_visitor_id');
          const cookieId = document.cookie.split('; ')
            .find(c => c.startsWith('datafast_visitor_id='))
            ?.split('=')[1] ?? null;
          const visitorId = cookieId ?? urlId;

          console.log('DataFast Visitor ID:', visitorId);

          try {
            const response = await fetch('/api/create-checkout-manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ visitorId })
            });

            const data = await response.json();
            if (data.checkoutUrl) {
              window.location.href = data.checkoutUrl;
            }
          } catch (error) {
            console.error('Checkout error:', error);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// ---------- Checkout API — Pattern A: server reads cookie automatically ----------
// The package extracts datafast_visitor_id (and datafast_session_id) from the
// Cookie header automatically. No client-side JS needed.

app.use('/api', express.json());

app.post('/api/create-checkout', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    // Pass req.headers.cookie as a string — the package parses it internally
    const checkout = await creemClient.createCheckout(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${req.protocol}://${req.get('host')}/success`,
      },
      req.headers.cookie   // ← automatic: reads datafast_visitor_id + datafast_session_id
    );

    res.redirect(303, checkout.checkoutUrl);
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// ---------- Checkout API — Pattern B: caller supplies visitor ID explicitly ----------
// Useful when you have the ID from a URL query param, a custom header, or any
// source other than cookies.

app.post('/api/create-checkout-manual', async (req, res) => {
  try {
    const { visitorId } = req.body;

    // Also check URL query param as a fallback (e.g. from email deep-links)
    const idFromUrl = getVisitorIdFromUrl(req.query as Record<string, string>);
    const resolvedId = visitorId ?? idFromUrl ?? null;

    const checkout = await creemClient.createCheckoutWithVisitorId(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${req.protocol}://${req.get('host')}/success`,
      },
      resolvedId
    );

    res.json({
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// ---------- Webhook ----------
// Use express.raw() so we get the raw body for HMAC signature verification.

app.post(
  '/webhooks/creem',
  express.raw({ type: 'application/json' }),
  creemDataFastWebhook({
    creemApiKey: CREEM_API_KEY,
    datafastApiKey: DATAFAST_API_KEY,
    webhookSecret: CREEM_WEBHOOK_SECRET,
    onPaymentSuccess: async ({ creemEvent, datafastResponse }) => {
      console.log('Payment forwarded to DataFast:', datafastResponse);
      console.log('CREEM event type:', creemEvent.eventType);
    },
    onError: async (error) => {
      console.error('Webhook processing error:', error.message);
    },
  })
);

// ---------- Success page ----------

app.get('/success', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
        .check { color: #28a745; font-size: 48px; }
      </style>
    </head>
    <body>
      <div class="check">&#10003;</div>
      <h1>Payment Successful!</h1>
      <p>Your payment has been recorded and revenue attributed to your traffic source.</p>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhooks/creem`);
});
