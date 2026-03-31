import { createCreemDataFastClient } from 'creem-datafast-integration';

let client: ReturnType<typeof createCreemDataFastClient> | null = null;

export function getCreemDataFast() {
  if (client) return client;

  const apiKey = process.env.CREEM_API_KEY;

  if (!apiKey) {
    throw new Error('Missing required env var: CREEM_API_KEY');
  }

  client = createCreemDataFastClient({
    apiKey,
    testMode: process.env.NODE_ENV !== 'production',
  });

  return client;
}