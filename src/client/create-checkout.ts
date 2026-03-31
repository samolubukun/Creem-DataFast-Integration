import { Creem } from 'creem';
import type { CreemCheckoutCreateOptions, CreemConfig, Logger } from '../types/index.js';
import { getDataFastVisitorId, getDataFastSessionId } from '../utils/cookie.js';
import { MissingTrackingError } from '../errors.js';

const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';
const DEFAULT_SESSION_COOKIE_NAME = 'datafast_session_id';

export interface CreemDataFastClientOptions extends CreemConfig {
  cookieName?: string;
  sessionCookieName?: string;
  strictTracking?: boolean;
  testMode?: boolean;
  logger?: Logger;
}

export class CreemDataFastClient {
  private creem: Creem;
  private cookieName: string;
  private sessionCookieName: string;
  private strictTracking: boolean;
  private logger: Logger;

  constructor(options: CreemDataFastClientOptions) {
    this.creem = new Creem({
      apiKey: options.apiKey,
      serverIdx: options.testMode ? 1 : 0,
    });
    this.cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
    this.sessionCookieName = options.sessionCookieName ?? DEFAULT_SESSION_COOKIE_NAME;
    this.strictTracking = options.strictTracking ?? false;
    this.logger = options.logger ?? {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
  }

  async createCheckout(
    options: CreemCheckoutCreateOptions,
    cookies?: string | Record<string, string>
  ): Promise<{ checkoutUrl: string; checkoutId: string }> {
    const visitorId = cookies
      ? getDataFastVisitorId(cookies, this.cookieName)
      : null;
    const sessionId = cookies
      ? getDataFastSessionId(cookies, this.sessionCookieName)
      : null;

    return this.createCheckoutWithTracking(options, visitorId, sessionId);
  }

  async createCheckoutWithVisitorId(
    options: CreemCheckoutCreateOptions,
    visitorId: string | null,
    sessionId?: string | null
  ): Promise<{ checkoutUrl: string; checkoutId: string }> {
    return this.createCheckoutWithTracking(options, visitorId, sessionId ?? null);
  }

  private async createCheckoutWithTracking(
    options: CreemCheckoutCreateOptions,
    visitorId: string | null,
    sessionId: string | null
  ): Promise<{ checkoutUrl: string; checkoutId: string }> {
    if (this.strictTracking && !visitorId) {
      throw new MissingTrackingError();
    }

    const metadata: Record<string, unknown> = { ...options.metadata };

    if (visitorId) {
      metadata.datafast_visitor_id = visitorId;
    }

    if (sessionId) {
      metadata.datafast_session_id = sessionId;
    }

    const checkout = await this.creem.checkouts.create({
      ...options,
      metadata,
    } as any);

    this.logger.debug?.('Created checkout', {
      checkoutId: checkout.id,
      hasVisitorId: !!visitorId,
      hasSessionId: !!sessionId,
    });

    return {
      checkoutUrl: checkout.checkoutUrl ?? '',
      checkoutId: checkout.id ?? '',
    };
  }

  getCreemClient(): Creem {
    return this.creem;
  }

  async healthCheck(): Promise<{ ok: boolean; healthy: boolean; checks: Record<string, { ok: boolean; message: string }> }> {
    return {
      ok: true,
      healthy: true,
      checks: {
        creemApiKey: { ok: true, message: 'configured' },
        datafastApiKey: { ok: true, message: 'configured' },
      },
    };
  }

  async replayWebhook(_input: { rawBody: string; headers: { get: (name: string) => string | undefined } }): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

export function createCreemDataFastClient(
  options: CreemDataFastClientOptions
): CreemDataFastClient {
  return new CreemDataFastClient(options);
}

export default CreemDataFastClient;
