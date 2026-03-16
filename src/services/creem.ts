import { Creem } from 'creem';

import { CreemDataFastError } from '../foundation/errors.js';
import type {
  CreemDataFastOptions,
  CreemSdkClientLike,
  InternalCreateCheckoutRequest,
  InternalCreemClient,
} from '../foundation/types.js';

function assertCreemClient(candidate: unknown): asserts candidate is CreemSdkClientLike {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !('checkouts' in candidate) ||
    !('transactions' in candidate)
  ) {
    throw new CreemDataFastError('Invalid creem client provided.');
  }
}

export function createCreemClient(options: CreemDataFastOptions): InternalCreemClient {
  const sdkCandidate =
    options.creemClient ??
    (options.creemApiKey
      ? new Creem({
          apiKey: options.creemApiKey,
          serverIdx: options.testMode ? 1 : 0,
        })
      : undefined);

  if (!sdkCandidate) {
    throw new CreemDataFastError('Missing creemApiKey or creemClient.');
  }

  assertCreemClient(sdkCandidate);

  return {
    async createCheckout(request: InternalCreateCheckoutRequest) {
      return sdkCandidate.checkouts.create(request as any);
    },
    async getTransactionById(transactionId: string) {
      return sdkCandidate.transactions.getById(transactionId);
    },
  };
}
