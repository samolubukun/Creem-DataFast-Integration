import { describe, expect, it, vi } from 'vitest';

import { createDataFastClient } from './datafast.js';

describe('datafast service extensions', () => {
  it('sends payments in batch and returns per-item results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null },
        text: async () => '{"ok":true}',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
        headers: { get: () => null },
        text: async () => '{"error":"boom"}',
      });

    const client = createDataFastClient({
      creemWebhookSecret: 'whsec_123',
      datafastApiKey: 'df_123',
      fetch: fetchMock as any,
      retry: { retries: 0 },
    });

    const output = await client.sendPayments?.([
      {
        amount: 10,
        currency: 'USD',
        transaction_id: 'tx_1',
        renewal: false,
      },
      {
        amount: 20,
        currency: 'USD',
        transaction_id: 'tx_2',
        renewal: true,
      },
    ]);

    expect(output).toBeDefined();
    expect(output?.results).toHaveLength(2);
    expect(output?.results[0]?.ok).toBe(true);
    expect(output?.results[1]?.ok).toBe(false);
  });

  it('queries getPayments by visitor id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      text: async () => '{"payments":[]}',
    });

    const client = createDataFastClient({
      creemWebhookSecret: 'whsec_123',
      datafastApiKey: 'df_123',
      fetch: fetchMock as any,
      datafastApiBaseUrl: 'https://datafa.st',
    });

    const response = await client.getPayments?.('visitor_123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://datafa.st/api/v1/payments?visitor_id=visitor_123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(response?.status).toBe(200);
    expect(response?.body).toEqual({ payments: [] });
  });
});
