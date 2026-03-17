import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWebhook } from './webhooks.js';
import * as signature from './signature.js';
import * as idempotency from '../storage/idempotency.js';
import { InvalidCreemSignatureError } from '../foundation/errors.js';

vi.mock('./signature.js');
vi.mock('../storage/idempotency.js');
vi.mock('./mapper.js');
vi.mock('./hydration.js');

describe('webhooks', () => {
  const dependencies: any = {
    creemWebhookSecret: 'secret',
    idempotencyStore: {},
    datafast: {
      sendPayment: vi.fn().mockResolvedValue({ success: true }),
    },
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  };

  const params: any = {
    headers: { 'creem-signature': 'valid' },
    rawBody: JSON.stringify({
      id: 'evt_123',
      eventType: 'checkout.completed',
      object: {
        order: { id: 'ord_123', amount: 1000, currency: 'USD' }
      }
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if signature is missing', async () => {
    vi.mocked(signature.extractHeader).mockReturnValue(undefined);
    await expect(handleWebhook({ ...params, headers: {} }, dependencies)).rejects.toThrow(
      InvalidCreemSignatureError
    );
  });

  it('throws if signature is invalid', async () => {
    vi.mocked(signature.extractHeader).mockReturnValue('invalid');
    vi.mocked(signature.verifyCreemSignature).mockResolvedValue(false);
    await expect(handleWebhook(params, dependencies)).rejects.toThrow(
      'Invalid Creem webhook signature.'
    );
  });

  it('successfully handles a checkout.completed event', async () => {
    vi.mocked(signature.extractHeader).mockReturnValue('valid');
    vi.mocked(signature.verifyCreemSignature).mockResolvedValue(true);
    vi.mocked(idempotency.claimEvent).mockResolvedValue(true);
    vi.mocked(idempotency.resolveIdempotencyStore).mockReturnValue({} as any);

    const result = await handleWebhook(params, dependencies);

    expect(result.ok).toBe(true);
    expect(result.ignored).toBe(false);
    expect(dependencies.datafast.sendPayment).toHaveBeenCalled();
    expect(idempotency.completeEvent).toHaveBeenCalled();
  });

  it('ignores duplicate events', async () => {
    vi.mocked(signature.extractHeader).mockReturnValue('valid');
    vi.mocked(signature.verifyCreemSignature).mockResolvedValue(true);
    vi.mocked(idempotency.claimEvent).mockResolvedValue(false);

    const result = await handleWebhook(params, dependencies);

    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('duplicate_event');
  });

  it('ignores unsupported events', async () => {
    vi.mocked(signature.extractHeader).mockReturnValue('valid');
    vi.mocked(signature.verifyCreemSignature).mockResolvedValue(true);
    vi.mocked(idempotency.claimEvent).mockResolvedValue(true);
    
    const unsupportedParams = {
      ...params,
      rawBody: JSON.stringify({ id: 'evt_123', eventType: 'unknown.event' })
    };

    const result = await handleWebhook(unsupportedParams, dependencies);

    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('unsupported_event');
  });
});
