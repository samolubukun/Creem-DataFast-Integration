import express from 'express';
import { config } from 'dotenv';
import { createCreemDataFastClient, creemDataFastWebhook } from 'creem-datafast-integration';

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
      </style>
      <!-- DataFast tracking script -->
      <script async defer src="https://cdn.datafa.st/tracking.js"></script>
    </head>
    <body>
      <div class="container">
        <h1>CREEM + DataFast Integration</h1>
        <p>This example demonstrates automatic revenue attribution between CREEM and DataFast.</p>
        
        <div class="info">
          <strong>How it works:</strong>
          <ul>
            <li>DataFast tracking script sets the <code>datafast_visitor_id</code> cookie</li>
            <li>On checkout, the visitor ID is injected into CREEM metadata</li>
            <li>When CREEM sends a webhook, payment data + visitor ID are forwarded to DataFast</li>
          </ul>
        </div>
        
        <button onclick="startCheckout()">Buy Now - $29.99</button>
        <p><small>Product: Premium Plan</small></p>
      </div>
      
      <script>
        function getCookie(name) {
          const value = '; ' + document.cookie;
          const parts = value.split('; ' + name + '=');
          if (parts.length === 2) return parts.pop().split(';').shift();
          return null;
        }
        
        async function startCheckout() {
          const visitorId = getCookie('datafast_visitor_id');
          console.log('DataFast Visitor ID:', visitorId);
          
          try {
            const response = await fetch('/api/create-checkout', {
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

// ---------- Checkout API ----------

app.use('/api', express.json());

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { visitorId } = req.body;

    const checkout = await creemClient.createCheckoutWithVisitorId(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${req.protocol}://${req.get('host')}/success`,
      },
      visitorId ?? null
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
// Use express.raw() so we get the raw body for signature verification.

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
