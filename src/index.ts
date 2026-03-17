import { createCheckout } from './engine/checkout.js';
import { createCreemClient } from './services/creem.js';
import { createDataFastClient } from './services/datafast.js';
import { InvalidCreemSignatureError } from './foundation/errors.js';
import { MemoryIdempotencyStore } from './storage/idempotency.js';
import { resolveLogger } from './foundation/logger.js';
import { extractHeader, verifyCreemSignature } from './engine/signature.js';
import { handleWebhook } from './engine/webhooks.js';
import type { CreemDataFastClient, CreemDataFastOptions, HeadersLike } from './foundation/types.js';

export type * from './foundation/types.js';
export * from './foundation/errors.js';
export { MemoryIdempotencyStore } from './storage/idempotency.js';

export function createCreemDataFast(options: CreemDataFastOptions): CreemDataFastClient {
  const logger = resolveLogger(options.logger);
  const creem = createCreemClient(options);
  const datafast = createDataFastClient(options);
  const captureSessionId = options.captureSessionId ?? true;
  const strictTracking = options.strictTracking ?? false;
  const hydrateTransactionOnSubscriptionPaid = options.hydrateTransactionOnSubscriptionPaid ?? true;
  const idempotencyStore = options.idempotencyStore ?? new MemoryIdempotencyStore();
  const idempotencyInFlightTtlSeconds = options.idempotencyInFlightTtlSeconds ?? 300;
  const idempotencyProcessedTtlSeconds = options.idempotencyProcessedTtlSeconds ?? 86400;

  return {
    createCheckout(params, context) {
      return createCheckout(params, context, {
        creem,
        captureSessionId,
        strictTracking,
        logger,
      });
    },
    handleWebhook(params) {
      return handleWebhook(params, {
        creemWebhookSecret: options.creemWebhookSecret,
        datafast,
        creem,
        idempotencyStore,
        idempotencyInFlightTtlSeconds,
        idempotencyProcessedTtlSeconds,
        hydrateTransactionOnSubscriptionPaid,
        logger,
      });
    },
    async verifyWebhookSignature(rawBody: string, headers: HeadersLike): Promise<boolean> {
      const signature = extractHeader(headers, 'creem-signature');
      if (!signature) {
        throw new InvalidCreemSignatureError('Missing creem-signature header.');
      }
      return verifyCreemSignature(rawBody, options.creemWebhookSecret, signature);
    },
  };
}
