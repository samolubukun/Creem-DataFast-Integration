import express from 'express';
import { config } from 'dotenv';
import { createCreemDataFast } from 'creem-datafast-integration';
import { createExpressWebhookHandler } from 'creem-datafast-integration/express';

config();

const app = express();

const creemDataFast = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: process.env.NODE_ENV !== 'production',
});

// ---------- Landing page ----------

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CREEM + DataFast Premium Integration</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 30px; border-radius: 8px; }
        button { background: #0066cc; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0052a3; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0; }
      </style>
      <script async defer src="https://cdn.datafa.st/tracking.js"></script>
    </head>
    <body>
      <div class="container">
        <h1>CREEM + DataFast Premium</h1>
        <p>This example demonstrates the Premium Engine Architecture.</p>
        <form action="/api/create-checkout" method="POST">
          <button type="submit">Buy Now - $29.99 (Cookie Capture)</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ---------- Checkout API ----------

app.post('/api/create-checkout', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { checkoutUrl } = await creemDataFast.createCheckout(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${req.protocol}://${req.get('host')}/success`,
      },
      { request: { headers: req.headers, url: req.url } }
    );

    res.redirect(303, checkoutUrl);
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// ---------- Webhook ----------

app.post(
  '/api/webhook/creem',
  express.raw({ type: 'application/json' }),
  createExpressWebhookHandler(creemDataFast, {
    onError: (error: Error) => {
      console.error('Webhook processing error:', error);
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
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook/creem`);
});
