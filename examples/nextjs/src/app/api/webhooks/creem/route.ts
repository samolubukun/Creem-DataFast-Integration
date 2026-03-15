import { createNextJsWebhookHandler } from 'creem-datafast-integration';

// createNextJsWebhookHandler returns a Next.js-compatible route handler directly.
// Mount it as the POST export — no wrapper needed.
export const POST = createNextJsWebhookHandler({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  onPaymentSuccess: async ({ creemEvent, datafastResponse }) => {
    console.log('Payment forwarded to DataFast:', datafastResponse);
    console.log('Event type:', creemEvent.eventType);
  },
  onError: async (error) => {
    console.error('Webhook error:', error.message);
  },
});
