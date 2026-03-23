import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { WebhookHandler, createWebhookHandler, verifyWebhookSignature } from '../../src/server/webhook-handler.js';
import { InvalidCreemSignatureError } from '../../src/errors.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Resolve SubtleCrypto the same way the source does, so tests pass on Node 18.
const subtle: SubtleCrypto =
  (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle)
    ? globalThis.crypto.subtle
    : (webcrypto as unknown as Crypto).subtle;

/** Compute HMAC-SHA256 hex via Web Crypto (mirrors production code). */
async function computeSignature(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('WebhookHandler', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signature verification', () => {
    it('rejects request without signature when webhookSecret is set', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
        webhookSecret: 'secret_123',
      });

      const result = await handler.handleWebhook('{}', undefined);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing creem-signature header');
    });

    it('rejects invalid signature', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
        webhookSecret: 'secret_123',
      });

      const result = await handler.handleWebhook('{"test":1}', 'invalid_signature');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid webhook signature');
    });

    it('accepts valid signature', async () => {
      const payload = JSON.stringify({ id: 'evt_1', eventType: 'checkout.completed', created_at: 1234567890, object: { id: 'ch_1', object: 'checkout', order: { id: 'ord_1', customer: 'c1', product: 'p1', amount: 1000, currency: 'USD', status: 'completed', type: 'one_time', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, product: { id: 'p1', name: 'Test', description: 'desc', image_url: null, price: 1000, currency: 'USD', billing_type: 'one_time', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://example.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, customer: { id: 'c1', object: 'customer', email: 'test@example.com', name: 'Test', country: 'US', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, status: 'completed', mode: 'live' } });
      const signature = await computeSignature('secret_123', payload);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'ok', transaction_id: 'txn_1' }),
      } as any);

      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
        webhookSecret: 'secret_123',
      });

      const result = await handler.handleWebhook(payload, signature);

      expect(result.success).toBe(true);
    });

    it('skips verification when no webhookSecret is set', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
      });

      const payload = JSON.stringify({ id: 'evt_1', eventType: 'checkout.completed', created_at: 1234567890, object: { id: 'ch_1', object: 'checkout', order: { id: 'ord_1', customer: 'c1', product: 'p1', amount: 1000, currency: 'USD', status: 'completed', type: 'one_time', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, product: { id: 'p1', name: 'Test', description: 'desc', image_url: null, price: 1000, currency: 'USD', billing_type: 'one_time', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://example.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, customer: { id: 'c1', object: 'customer', email: 'test@example.com', name: 'Test', country: 'US', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, status: 'completed', mode: 'live' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'ok', transaction_id: 'txn_1' }),
      } as any);

      const result = await handler.handleWebhook(payload, 'any_signature');

      expect(result.success).toBe(true);
    });
  });

  describe('event handling', () => {
    it('ignores unsupported event types', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
      });

      const result = await handler.handleWebhook(
        JSON.stringify({ id: 'evt_1', eventType: 'checkout.created', created_at: 1234567890, object: {} })
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('ignored');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('processes checkout.completed events', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
      });

      const payload = JSON.stringify({
        id: 'evt_1',
        eventType: 'checkout.completed',
        created_at: 1234567890,
        object: {
          id: 'ch_1',
          object: 'checkout',
          order: { id: 'ord_1', customer: 'c1', product: 'p1', amount: 2999, currency: 'EUR', status: 'completed', type: 'one_time', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          product: { id: 'p1', name: 'Pro', description: 'desc', image_url: null, price: 2999, currency: 'EUR', billing_type: 'one_time', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://example.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          customer: { id: 'c1', object: 'customer', email: 'test@example.com', name: 'Test User', country: 'US', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          metadata: { datafast_visitor_id: 'df_123' },
          status: 'completed',
          mode: 'live'
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'ok', transaction_id: 'ord_1' }),
      } as any);

      const result = await handler.handleWebhook(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0] as any;
      const body = JSON.parse(fetchCall[1].body);
      expect(body.transaction_id).toBe('ord_1');
      expect(body.amount).toBe(29.99);
      expect(body.datafast_visitor_id).toBe('df_123');
    });

    it('processes subscription.paid events', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
      });

      const payload = JSON.stringify({
        id: 'evt_sub',
        eventType: 'subscription.paid',
        created_at: 1234567890,
        object: {
          id: 'sub_1',
          object: 'subscription',
          product: { id: 'p1', name: 'Monthly', description: 'desc', image_url: null, price: 1999, currency: 'GBP', billing_type: 'recurring', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://example.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          customer: { id: 'c1', object: 'customer', email: 'sub@example.com', name: 'Subscriber', country: 'UK', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          collection_method: 'chargeAutomatically',
          status: 'active',
          last_transaction_id: 'txn_sub',
          last_transaction_date: '2024-02-01',
          metadata: { datafast_visitor_id: 'df_sub' },
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          mode: 'live'
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'ok', transaction_id: 'txn_sub' }),
      } as any);

      const result = await handler.handleWebhook(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0] as any;
      const body = JSON.parse(fetchCall[1].body);
      expect(body.transaction_id).toBe('txn_sub');
      expect(body.renewal).toBe(true);
      expect(body.datafast_visitor_id).toBe('df_sub');
    });
  });

  describe('error handling', () => {
    it('handles invalid JSON', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
      });

      const result = await handler.handleWebhook('invalid json');

      expect(result.success).toBe(false);
      expect(result.message).toContain('JSON');
    });

    it('handles DataFast API errors', async () => {
      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
      });

      const payload = JSON.stringify({
        id: 'evt_1',
        eventType: 'checkout.completed',
        created_at: 1234567890,
        object: {
          id: 'ch_1',
          object: 'checkout',
          order: { id: 'ord_1', customer: 'c1', product: 'p1', amount: 1000, currency: 'USD', status: 'completed', type: 'one_time', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          product: { id: 'p1', name: 'Test', description: 'desc', image_url: null, price: 1000, currency: 'USD', billing_type: 'one_time', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://example.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          customer: { id: 'c1', object: 'customer', email: 'test@example.com', name: 'Test', country: 'US', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          status: 'completed',
          mode: 'live'
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as any);

      const result = await handler.handleWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.message).toContain('DataFast API error');
    });

    it('calls onError callback on failure', async () => {
      const onError = vi.fn();

      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
        onError,
      });

      await handler.handleWebhook('invalid json');

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('calls onPaymentSuccess callback on success', async () => {
      const onPaymentSuccess = vi.fn();

      handler = createWebhookHandler({
        creemApiKey: 'creem_key',
        datafastApiKey: 'datafast_key',
        onPaymentSuccess,
      });

      const payload = JSON.stringify({
        id: 'evt_1',
        eventType: 'checkout.completed',
        created_at: 1234567890,
        object: {
          id: 'ch_1',
          object: 'checkout',
          order: { id: 'ord_1', customer: 'c1', product: 'p1', amount: 1000, currency: 'USD', status: 'completed', type: 'one_time', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          product: { id: 'p1', name: 'Test', description: 'desc', image_url: null, price: 1000, currency: 'USD', billing_type: 'one_time', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://example.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          customer: { id: 'c1', object: 'customer', email: 'test@example.com', name: 'Test', country: 'US', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' },
          status: 'completed',
          mode: 'live'
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'ok', transaction_id: 'ord_1' }),
      } as any);

      await handler.handleWebhook(payload);

      expect(onPaymentSuccess).toHaveBeenCalledTimes(1);
      expect(onPaymentSuccess.mock.calls[0][0]).toHaveProperty('creemEvent');
      expect(onPaymentSuccess.mock.calls[0][0]).toHaveProperty('datafastResponse');
    });
  });
});

describe('verifyWebhookSignature', () => {
  it('resolves for a valid signature', async () => {
    const payload = '{"id":"evt_1"}';
    const sig = await computeSignature('my_secret', payload);
    await expect(verifyWebhookSignature(payload, sig, 'my_secret')).resolves.toBeUndefined();
  });

  it('throws InvalidCreemSignatureError for an invalid signature', async () => {
    await expect(
      verifyWebhookSignature('{"id":"evt_1"}', 'badhex', 'my_secret')
    ).rejects.toBeInstanceOf(InvalidCreemSignatureError);
  });
});
