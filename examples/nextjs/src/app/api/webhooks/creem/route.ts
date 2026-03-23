import { createNextWebhookHandler } from 'creem-datafast-integration/next';
import { getCreemDataFast } from '../../../../lib/creem-datafast';

export async function POST(request: Request) {
  const handler = createNextWebhookHandler(getCreemDataFast(), {
    onError: (error: Error) => {
      console.error('Webhook error:', error);
    },
  });

  return handler(request);
}
