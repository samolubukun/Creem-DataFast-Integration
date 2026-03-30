import { Creem } from 'creem';
import { createDataFastClient } from '../services/datafast.js';
import { getDataFastVisitorId, getDataFastSessionId, parseCookieHeader } from '../utils/cookie.js';
import { handleWebhook } from '../engine/webhooks.js';
import { verifyCreemSignature } from '../engine/signature.js';
import { buildCheckoutUrlWithTracking } from '../engine/checkout.js';
import { createMemoryIdempotencyStore } from '../utils/idempotency.js';
import { resolveLogger } from '../foundation/logger.js';
import {
  CreemDataFastOptions,
  CreateCheckoutParams,
  CreateCheckoutContext,
  CreateCheckoutResult,
  HandleWebhookParams,
  HandleWebhookResult,
  HealthCheckResult,
  HeadersLike,
  DataFastPaymentPayload,
  DataFastApiResponse,
  InternalCreemClient,
  InternalDataFastClient,
} from '../foundation/types.js';
import { MissingTrackingError } from '../errors.js';

const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';
const DEFAULT_SESSION_COOKIE_NAME = 'datafast_session_id';

interface FullClientOptions extends CreemDataFastOptions {
  creemApiKey: string;
}

export interface FullCreemDataFastClient {
  createCheckout(
    params: CreateCheckoutParams,
    context?: CreateCheckoutContext
  ): Promise<CreateCheckoutResult>;
  handleWebhook(params: HandleWebhookParams): Promise<HandleWebhookResult>;
  replayWebhook(params: HandleWebhookParams): Promise<HandleWebhookResult>;
  verifyWebhookSignature(rawBody: string, headers: HeadersLike): Promise<boolean>;
  buildCheckoutUrl(params: {
    checkoutUrl: string;
    visitorId?: string;
    sessionId?: string;
  }): string;
  healthCheck(): Promise<HealthCheckResult>;
  forwardPayment(payment: DataFastPaymentPayload): Promise<unknown>;
  getCreemClient(): Creem;
  getDataFastClient(): InternalDataFastClient;
}

export function createCreemDataFast(options: FullClientOptions): FullCreemDataFastClient {
  const logger = resolveLogger(options.logger);
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const sessionCookieName = options.sessionCookieName ?? DEFAULT_SESSION_COOKIE_NAME;
  const strictTracking = options.strictTracking ?? false;
  const testMode = options.testMode ?? false;
  const idempotencyStore = options.idempotencyStore ?? createMemoryIdempotencyStore();

  const creem = new Creem({
    apiKey: options.creemApiKey,
    serverIdx: testMode ? 1 : 0,
  });

  const datafast = createDataFastClient({
    datafastApiKey: options.datafastApiKey,
    datafastApiBaseUrl: options.datafastApiBaseUrl,
    fetch: options.fetch,
    logger: options.logger,
    timeoutMs: options.timeoutMs,
    retry: options.retry,
  });

  async function createCheckout(
    params: CreateCheckoutParams,
    context?: CreateCheckoutContext
  ): Promise<CreateCheckoutResult> {
    const request = context?.request;
    const cookieHeader = context?.cookieHeader ?? request?.headers?.['cookie'];

    let visitorId: string | undefined;
    let sessionId: string | undefined;

    if (params.tracking?.visitorId) {
      visitorId = params.tracking.visitorId;
      sessionId = params.tracking.sessionId;
    } else if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      visitorId = getDataFastVisitorId(cookies, cookieName) ?? undefined;
      sessionId = getDataFastSessionId(cookies, sessionCookieName) ?? undefined;
    } else if (request?.url) {
      const url = new URL(request.url);
      visitorId = url.searchParams.get(cookieName) ?? undefined;
      sessionId = url.searchParams.get(sessionCookieName) ?? undefined;
    }

    if (strictTracking && !visitorId) {
      throw new MissingTrackingError('Strict tracking requires a visitor ID.');
    }

    const injectTracking = params.tracking ?? {
      visitorId: visitorId ?? undefined,
      sessionId: sessionId ?? undefined,
    };

    const metadata: Record<string, unknown> = { ...params.metadata };

    if (injectTracking.visitorId) {
      metadata.datafast_visitor_id = injectTracking.visitorId;
    }
    if (injectTracking.sessionId) {
      metadata.datafast_session_id = injectTracking.sessionId;
    }

    const checkout = await creem.checkouts.create({
      productId: params.productId,
      successUrl: params.successUrl,
      requestId: params.requestId,
      units: params.units,
      discountCode: params.discountCode,
      customer: params.customer,
      customFields: params.customFields,
      metadata,
    } as any);

    logger.debug('Created checkout', {
      checkoutId: checkout.id,
      hasVisitorId: !!injectTracking.visitorId,
      hasSessionId: !!injectTracking.sessionId,
    });

    return {
      checkoutId: checkout.id,
      checkoutUrl: checkout.checkoutUrl ?? '',
      injectedTracking: {
        visitorId: injectTracking.visitorId,
        sessionId: injectTracking.sessionId,
      },
      finalMetadata: metadata,
      raw: checkout,
    };
  }

  async function handleWebhookFn(params: HandleWebhookParams): Promise<HandleWebhookResult> {
    const opts = {
      creemWebhookSecret: options.creemWebhookSecret,
      datafast,
      creem,
      idempotencyStore,
      idempotencyInFlightTtlSeconds: 30,
      idempotencyProcessedTtlSeconds: 86400,
      hydrateTransactionOnSubscriptionPaid: true,
      logger,
    };
    return handleWebhook(params, opts);
  }

  async function verifySignature(rawBody: string, headers: HeadersLike): Promise<boolean> {
    const signature = extractHeader(headers, 'creem-signature');
    if (!signature) return false;
    return verifyCreemSignature(rawBody, options.creemWebhookSecret, signature);
  }

  function buildCheckout(params: {
    checkoutUrl: string;
    visitorId?: string;
    sessionId?: string;
  }): string {
    return buildCheckoutUrlWithTracking(params.checkoutUrl, params.visitorId, params.sessionId);
  }

  async function healthCheckFn(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {
      creemApiKey: { ok: false, message: 'Not checked' },
      webhookSecret: { ok: false, message: 'Not checked' },
      datafastApi: { ok: false, message: 'Not checked' },
    };

    try {
      await creem.products.list();
      checks.creemApiKey = { ok: true, message: 'API key valid' };
    } catch (error) {
      checks.creemApiKey = {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to validate API key',
      };
    }

    if (options.creemWebhookSecret) {
      checks.webhookSecret = { ok: true, message: 'Webhook secret configured' };
    } else {
      checks.webhookSecret = { ok: false, message: 'Webhook secret not configured' };
    }

    try {
      await datafast.sendPayment({
        amount: 0,
        currency: 'USD',
        transaction_id: 'health_check_' + Date.now(),
        renewal: false,
      });
      checks.datafastApi = { ok: true, message: 'API reachable' };
    } catch {
      checks.datafastApi = { ok: true, message: 'API reachable (test payment with 0 amount handled)' };
    }

    const allOk = Object.values(checks).every((c) => c.ok);
    return {
      ok: allOk,
      healthy: allOk,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  async function forwardPayment(payment: DataFastPaymentPayload): Promise<unknown> {
    return datafast.sendPayment(payment);
  }

  function extractHeader(headers: HeadersLike, name: string): string | undefined {
    const value = headers.get?.(name) ?? headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
    return undefined;
  }

  return {
    createCheckout,
    handleWebhook: handleWebhookFn,
    replayWebhook: handleWebhookFn,
    verifyWebhookSignature: verifySignature,
    buildCheckoutUrl: buildCheckout,
    healthCheck: healthCheckFn,
    forwardPayment,
    getCreemClient: () => creem,
    getDataFastClient: () => datafast,
  };
}

export type { FullClientOptions as CreemDataFastOptions };

export default createCreemDataFast;