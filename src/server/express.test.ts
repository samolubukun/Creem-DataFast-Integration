import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { creemDataFastWebhook } from '../../src/server/express.js';

vi.mock('../../src/server/webhook-handler', () => ({
  createWebhookHandler: vi.fn().mockReturnValue({
    handleWebhook: vi.fn(),
  }),
}));

describe('Express middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      headers: { 'creem-signature': 'valid_sig' },
      body: JSON.stringify({ id: 'evt_1', eventType: 'checkout.completed', created_at: 123, object: { id: 'ch_1', object: 'checkout', order: { id: 'o1', customer: 'c1', product: 'p1', amount: 1000, currency: 'USD', status: 'completed', type: 'one_time', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, product: { id: 'p1', name: 'Test', description: 'd', image_url: null, price: 1000, currency: 'USD', billing_type: 'one_time', status: 'active', tax_mode: 'none', tax_category: 'digital', default_success_url: 'https://x.com', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, customer: { id: 'c1', object: 'customer', email: 't@t.com', name: 'T', country: 'US', created_at: '2024-01-01', updated_at: '2024-01-01', mode: 'live' }, status: 'completed', mode: 'live' } }),
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('calls next with error on exception', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockRejectedValue(new Error('Test error')),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    const middleware = creemDataFastWebhook({
      creemApiKey: 'key',
      datafastApiKey: 'df_key',
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('returns 200 on successful webhook processing', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    const middleware = creemDataFastWebhook({
      creemApiKey: 'key',
      datafastApiKey: 'df_key',
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok', message: 'ok' });
  });

  it('returns 400 on failed webhook processing', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: false, message: 'Invalid signature' }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    const middleware = creemDataFastWebhook({
      creemApiKey: 'key',
      datafastApiKey: 'df_key',
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ status: 'error', message: 'Invalid signature' });
  });

  it('handles Buffer body', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    mockReq.body = Buffer.from(mockReq.body as string);

    const middleware = creemDataFastWebhook({
      creemApiKey: 'key',
      datafastApiKey: 'df_key',
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockHandler.handleWebhook).toHaveBeenCalled();
  });
});
