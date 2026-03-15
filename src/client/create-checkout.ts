import { Creem } from 'creem';
import type { CreemCheckoutCreateOptions, CreemConfig, Logger } from '../types/index.js';
import { getDataFastVisitorId, getDataFastSessionId } from '../utils/cookie.js';
import { MissingTrackingError } from '../errors.js';

const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';
const DEFAULT_SESSION_COOKIE_NAME = 'datafast_session_id';

export interface CreemDataFastClientOptions extends CreemConfig {
  /**
   * Inject a pre-configured Creem SDK instance instead of having the package
   * create one from `apiKey`.  Useful for sharing a single SDK instance across
   * your app or for testing.
   */
  creemClient?: Creem;
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
    // Accept an injected client or build one from apiKey
    this.creem = options.creemClient ?? new Creem({
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
}

export function createCreemDataFastClient(
  options: CreemDataFastClientOptions
): CreemDataFastClient {
  return new CreemDataFastClient(options);
}

export default CreemDataFastClient;
