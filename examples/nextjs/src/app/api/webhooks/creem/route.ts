import { createNextWebhookHandler } from 'creem-datafast-integration/next';
import { createCreemDataFast } from 'creem-datafast-integration';

const creemDataFast = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  testMode: process.env.NODE_ENV !== 'production',
  webhookDryRun: process.env.WEBHOOK_DRY_RUN === 'true',
});

export const POST = createNextWebhookHandler(creemDataFast, {
  onError: (error: Error) => {
    console.error('Webhook error:', error);
  },
});
