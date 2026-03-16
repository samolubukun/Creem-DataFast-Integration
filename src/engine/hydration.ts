import { TransactionHydrationError } from '../foundation/errors.js';
import type { InternalCreemClient, NormalizedTransaction } from '../foundation/types.js';

interface RawTransaction {
  id?: string;
  amount?: number;
  currency?: string;
  createdAt?: number;
  created_at?: number;
}

function toIsoTimestamp(input?: number): string | undefined {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return undefined;
  }

  const ms = input > 1e12 ? input : input * 1000;
  return new Date(ms).toISOString();
}

export async function hydrateTransaction(
  creem: InternalCreemClient,
  transactionId: string
): Promise<NormalizedTransaction> {
  try {
    const rawTransaction = (await creem.getTransactionById(transactionId)) as RawTransaction;
    if (
      !rawTransaction ||
      typeof rawTransaction.id !== 'string' ||
      typeof rawTransaction.amount !== 'number' ||
      typeof rawTransaction.currency !== 'string'
    ) {
      throw new TransactionHydrationError('Creem transaction response is missing required fields.');
    }

    return {
      amount: rawTransaction.amount,
      currency: rawTransaction.currency,
      id: rawTransaction.id,
      timestamp: toIsoTimestamp(rawTransaction.createdAt ?? rawTransaction.created_at),
    };
  } catch (error) {
    if (error instanceof TransactionHydrationError) {
      throw error;
    }

    throw new TransactionHydrationError(`Failed to hydrate transaction ${transactionId}.`, {
      cause: error,
    });
  }
}
