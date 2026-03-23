import { describe, expect, it, vi } from 'vitest';

import { createCreemDataFast } from './index.js';

describe('public API parity methods', () => {
  function makeClient(overrides: Record<string, unknown> = {}) {
    return createCreemDataFast({
      creemWebhookSecret: 'whsec_test',
      datafastApiKey: 'df_test',
      creemClient: {
        checkouts: {
          create: vi.fn().mockResolvedValue({
            id: 'checkout_123',
            checkoutUrl: 'https://checkout.creem.io/ch_123',
          }),
        },
        transactions: {
          getById: vi.fn().mockResolvedValue({
            id: 'txn_123',
            amount: 1000,
            currency: 'USD',
            created_at: 1730000000,
          }),
        },
      },
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null },
        text: async () => '{"ok":true}',
      }) as any,
      ...overrides,
    });
  }

  it('buildCheckoutUrl appends visitor and session values', () => {
    const client = makeClient();
    const url = client.buildCheckoutUrl({
      checkoutUrl: 'https://checkout.creem.io/p/abc',
      visitorId: 'v_123',
      sessionId: 's_456',
    });

    expect(url).toContain('datafast_visitor_id=v_123');
    expect(url).toContain('datafast_session_id=s_456');
  });

  it('healthCheck returns expected shape', async () => {
    const client = makeClient();
    const result = await client.healthCheck();

    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('healthy');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('timestamp');
  });

  it('exposes replayWebhook as callable API', async () => {
    const client = makeClient();
    expect(typeof client.replayWebhook).toBe('function');
  });
});
