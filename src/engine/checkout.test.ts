import { describe, expect, it, vi } from 'vitest';

import { MetadataCollisionError } from '../foundation/errors.js';
import { createCheckout } from './checkout.js';

function makeDependencies() {
  return {
    creem: {
      createCheckout: vi.fn().mockResolvedValue({
        id: 'checkout_123',
        checkoutUrl: 'https://checkout.creem.io/test',
      }),
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    captureSessionId: true,
    strictTracking: false,
  };
}

describe('checkout merge strategies', () => {
  it('throws on visitor metadata collision when mergeStrategy is error', async () => {
    const dependencies = makeDependencies();

    await expect(
      createCheckout(
        {
          productId: 'prod_123',
          successUrl: 'https://app.test/success',
          metadata: { datafast_visitor_id: 'existing_visitor' },
          tracking: { visitorId: 'new_visitor' },
          mergeStrategy: 'error',
        },
        undefined,
        dependencies
      )
    ).rejects.toBeInstanceOf(MetadataCollisionError);

    expect(dependencies.creem.createCheckout).not.toHaveBeenCalled();
  });

  it('overwrites metadata visitor and session when mergeStrategy is overwrite', async () => {
    const dependencies = makeDependencies();

    const result = await createCheckout(
      {
        productId: 'prod_123',
        successUrl: 'https://app.test/success',
        metadata: {
          datafast_visitor_id: 'existing_visitor',
          datafast_session_id: 'existing_session',
        },
        tracking: { visitorId: 'new_visitor', sessionId: 'new_session' },
        mergeStrategy: 'overwrite',
      },
      undefined,
      dependencies
    );

    expect(result.finalMetadata.datafast_visitor_id).toBe('new_visitor');
    expect(result.finalMetadata.datafast_session_id).toBe('new_session');
    expect(dependencies.creem.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          datafast_visitor_id: 'new_visitor',
          datafast_session_id: 'new_session',
        }),
      })
    );
  });
});
