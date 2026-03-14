import { NextRequest } from 'next/server';
import { creemDataFastWebhookHandler } from 'creem-datafast';

export async function POST(request: NextRequest) {
  return creemDataFastWebhookHandler(request, {
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
}
