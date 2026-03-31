import { createCreemDataFastClient } from 'creem-datafast-integration';

let client: ReturnType<typeof createCreemDataFastClient> | null = null;

export function getCreemDataFast() {
  if (client) return client;

  const creemApiKey = process.env.CREEM_API_KEY;
  const creemWebhookSecret = process.env.CREEM_WEBHOOK_SECRET;
  const datafastApiKey = process.env.DATAFAST_API_KEY;

  if (!creemApiKey || !creemWebhookSecret || !datafastApiKey) {
    throw new Error(
      'Missing required env vars: CREEM_API_KEY, CREEM_WEBHOOK_SECRET, DATAFAST_API_KEY'
    );
  }

  client = createCreemDataFastClient({
    creemApiKey,
    creemWebhookSecret,
    datafastApiKey,
    testMode: process.env.NODE_ENV !== 'production',
    dryRun: process.env.WEBHOOK_DRY_RUN === 'true',
  });

  return client;
}