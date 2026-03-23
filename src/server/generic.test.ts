import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGenericWebhook } from '../../src/server/generic.js';

vi.mock('../../src/server/webhook-handler', () => ({
  createWebhookHandler: vi.fn().mockReturnValue({
    handleWebhook: vi.fn(),
  }),
}));

describe('Generic webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handler with correct parameters', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    const result = await handleGenericWebhook({
      creemApiKey: 'creem_key',
      datafastApiKey: 'df_key',
      getRawBody: vi.fn().mockResolvedValue('{}'),
      getHeaders: vi.fn().mockReturnValue({ 'creem-signature': 'sig' }),
    });

    expect(result.success).toBe(true);
    expect(mockHandler.handleWebhook).toHaveBeenCalledWith('{}', 'sig');
  });

  it('passes webhookSecret to handler', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: true }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    await handleGenericWebhook({
      creemApiKey: 'creem_key',
      datafastApiKey: 'df_key',
      webhookSecret: 'secret_123',
      getRawBody: vi.fn().mockResolvedValue('{}'),
      getHeaders: vi.fn().mockReturnValue({}),
    });

    expect(createWebhookHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookSecret: 'secret_123',
      })
    );
  });

  it('handles missing signature', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: true }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    await handleGenericWebhook({
      creemApiKey: 'creem_key',
      datafastApiKey: 'df_key',
      getRawBody: vi.fn().mockResolvedValue('{}'),
      getHeaders: vi.fn().mockReturnValue({}),
    });

    expect(mockHandler.handleWebhook).toHaveBeenCalledWith('{}', undefined);
  });

  it('calls callbacks when provided', async () => {
    const { createWebhookHandler } = await import('../../src/server/webhook-handler.js');
    const mockHandler = {
      handleWebhook: vi.fn().mockResolvedValue({ success: true }),
    };
    (createWebhookHandler as any).mockReturnValue(mockHandler);

    const onSuccess = vi.fn();
    const onError = vi.fn();

    await handleGenericWebhook({
      creemApiKey: 'creem_key',
      datafastApiKey: 'df_key',
      onPaymentSuccess: onSuccess,
      onError: onError,
      getRawBody: vi.fn().mockResolvedValue('{}'),
      getHeaders: vi.fn().mockReturnValue({}),
    });

    expect(createWebhookHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        onPaymentSuccess: onSuccess,
        onError: onError,
      })
    );
  });
});
