import { describe, it, expect, vi } from 'vitest';
import { hydrateTransaction } from './hydration.js';
import { TransactionHydrationError } from '../foundation/errors.js';

describe('hydration', () => {
  it('hydrates a valid transaction', async () => {
    const creem = {
      getTransactionById: vi.fn().mockResolvedValue({
        id: 'txn_123',
        amount: 1000,
        currency: 'USD',
        createdAt: 1773705600, // 2026-03-17T00:00:00Z (Unix)
      }),
    };

    const result = await hydrateTransaction(creem as any, 'txn_123');

    expect(result).toEqual({
      id: 'txn_123',
      amount: 1000,
      currency: 'USD',
      timestamp: '2026-03-17T00:00:00.000Z',
    });
  });

  it('throws on missing required fields', async () => {
    const creem = {
      getTransactionById: vi.fn().mockResolvedValue({ id: 'txn_123' }),
    };

    await expect(hydrateTransaction(creem as any, 'txn_123')).rejects.toThrow(
      TransactionHydrationError
    );
  });

  it('wraps generic errors', async () => {
    const creem = {
      getTransactionById: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    await expect(hydrateTransaction(creem as any, 'txn_123')).rejects.toThrow(
      'Failed to hydrate transaction txn_123.'
    );
  });
});
