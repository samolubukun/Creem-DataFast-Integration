import { createCheckout } from './engine/checkout.js';
import { createCreemClient } from './services/creem.js';
import { createDataFastClient } from './services/datafast.js';
import { InvalidCreemSignatureError } from './foundation/errors.js';
import { MemoryIdempotencyStore } from './storage/idempotency.js';
import { resolveLogger } from './foundation/logger.js';
import { extractHeader, verifyCreemSignature } from './engine/signature.js';
import { handleWebhook } from './engine/webhooks.js';
import type { CreemDataFastClient, CreemDataFastOptions, HeadersLike } from './foundation/types.js';
import { buildCheckoutUrlWithVisitorId } from './client/index.js';

export type * from './foundation/types.js';
export * from './foundation/errors.js';
export { MemoryIdempotencyStore } from './storage/idempotency.js';
export { createUpstashIdempotencyStore as UpstashIdempotencyStore } from './storage/upstash.js';

async function runHealthCheck(options: CreemDataFastOptions): Promise<any> {
  const checks = {
    creemApiKey: {
      ok: Boolean(options.creemApiKey || options.creemClient),
      message: options.creemApiKey || options.creemClient ? 'configured' : 'missing creem credentials',
    },
    webhookSecret: {
      ok: Boolean(options.creemWebhookSecret),
      message: options.creemWebhookSecret ? 'configured' : 'missing webhook secret',
    },
    datafastApi: {
      ok: false,
      message: 'not checked',
    },
  };

  try {
    const datafast = createDataFastClient(options);
    await datafast.getPayments?.('__healthcheck__');
    checks.datafastApi = { ok: true, message: 'reachable' };
  } catch (error) {
    checks.datafastApi = {
      ok: false,
      message: error instanceof Error ? error.message : 'unreachable',
    };
  }

  return {
    healthy: checks.creemApiKey.ok && checks.webhookSecret.ok && checks.datafastApi.ok,
    checks,
    timestamp: new Date().toISOString(),
  };
}

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
        eventFilter: options.eventFilter,
        dryRun: options.dryRun,
        onDeadLetter: options.onDeadLetter,
        retry: options.retry,
        hydrateTransactionOnSubscriptionPaid,
        logger,
      });
    },
    replayWebhook(params) {
      return handleWebhook(
        params,
        {
          creemWebhookSecret: options.creemWebhookSecret,
          datafast,
          creem,
          idempotencyStore,
          idempotencyInFlightTtlSeconds,
          idempotencyProcessedTtlSeconds,
          eventFilter: options.eventFilter,
          dryRun: options.dryRun,
          onDeadLetter: options.onDeadLetter,
          retry: options.retry,
          hydrateTransactionOnSubscriptionPaid,
          logger,
        },
        { skipIdempotency: true }
      );
    },
    buildCheckoutUrl({ checkoutUrl, visitorId, sessionId, mergeStrategy }) {
      const url = buildCheckoutUrlWithVisitorId(checkoutUrl, visitorId ?? null);
      if (!sessionId) {
        return url;
      }

      const parsed = new URL(url);
      if (mergeStrategy === 'preserve' && parsed.searchParams.has('datafast_session_id')) {
        return parsed.toString();
      }
      parsed.searchParams.set('datafast_session_id', sessionId);
      return parsed.toString();
    },
    async healthCheck() {
      return runHealthCheck(options);
    },
    async sendPayments(payloads) {
      if (!datafast.sendPayments) {
        return { results: [] };
      }
      return datafast.sendPayments(payloads);
    },
    async getPayments(visitorId) {
      if (!datafast.getPayments) {
        return { status: 501, body: { error: 'getPayments not implemented' } };
      }
      return datafast.getPayments(visitorId);
    },
    creem,
    async verifyWebhookSignature(rawBody: string, headers: HeadersLike): Promise<boolean> {
      const signature = extractHeader(headers, 'creem-signature');
      if (!signature) {
        throw new InvalidCreemSignatureError('Missing creem-signature header.');
      }
      return verifyCreemSignature(rawBody, options.creemWebhookSecret, signature);
    },
  };
}
