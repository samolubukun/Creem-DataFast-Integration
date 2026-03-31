import { createCreemDataFastClient } from 'creem-datafast-integration';

let client: ReturnType<typeof createCreemDataFastClient> | null = null;

export function getCreemDataFast() {
  if (client) return client;

  const apiKey = process.env.CREEM_API_KEY;
  const datafastApiKey = process.env.DATAFAST_API_KEY;

  if (!apiKey || !datafastApiKey) {
    throw new Error('Missing required env vars: CREEM_API_KEY, DATAFAST_API_KEY');
  }

  client = createCreemDataFastClient({
    apiKey,
    datafastApiKey,
    testMode: process.env.NODE_ENV !== 'production',
  });

  return client;
}