import { Creem } from 'creem';
import type { CreemCheckoutCreateOptions, CreemConfig } from '../types/index.js';
import { getDataFastVisitorId } from '../utils/cookie.js';

const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';

export interface CreemDataFastClientOptions extends CreemConfig {
  cookieName?: string;
}

/**
 * A thin wrapper around the core CREEM SDK that automatically injects the
 * DataFast visitor ID into checkout metadata so payments can be attributed.
 */
export class CreemDataFastClient {
  private creem: Creem;
  private cookieName: string;

  constructor(options: CreemDataFastClientOptions) {
    this.creem = new Creem({
      apiKey: options.apiKey,
      serverIdx: options.serverIdx ?? 0,
    });
    this.cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  }

  /**
   * Create a CREEM checkout and inject the DataFast visitor ID into
   * checkout metadata.
   *
   * Use this when you have access to the raw Cookie header or a parsed
   * cookies object from the incoming HTTP request.
   *
   * @param options  Standard CREEM checkout options.
   * @param cookies  The raw `Cookie` header string, or a parsed `{ name: value }` object.
   */
  async createCheckout(
    options: CreemCheckoutCreateOptions,
    cookies?: string | Record<string, string>
  ): Promise<{ checkoutUrl: string; checkoutId: string }> {
    const visitorId = cookies
      ? getDataFastVisitorId(cookies, this.cookieName)
      : null;

    return this.createCheckoutWithVisitorId(options, visitorId);
  }

  /**
   * Create a CREEM checkout with an explicit DataFast visitor ID.
   *
   * Use this when the client has already extracted the visitor ID
   * (e.g. from `document.cookie` on the browser) and sent it to your
   * server in the request body.
   */
  async createCheckoutWithVisitorId(
    options: CreemCheckoutCreateOptions,
    visitorId: string | null
  ): Promise<{ checkoutUrl: string; checkoutId: string }> {
    const metadata = visitorId
      ? { ...options.metadata, datafast_visitor_id: visitorId }
      : options.metadata ?? {};

    const checkout = await this.creem.checkouts.create({
      ...options,
      metadata,
    } as any);

    return {
      checkoutUrl: checkout.checkoutUrl ?? '',
      checkoutId: checkout.id ?? '',
    };
  }

  /** Access the underlying CREEM SDK client. */
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
