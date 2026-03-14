import { createWebhookHandler } from './webhook-handler.js';
import type { WebhookHandlerOptions } from '../types/index.js';

export interface GenericWebhookHandlerOptions extends WebhookHandlerOptions {
  /** Return the raw request body as a string. */
  getRawBody: () => Promise<string> | string;
  /** Return the request headers. */
  getHeaders: () => Record<string, string | string[] | undefined>;
}

/**
 * Framework-agnostic webhook handler.  Works with Hono, Fastify, Koa,
 * Cloudflare Workers, or anything else.
 *
 * ```ts
 * const result = await handleGenericWebhook({
 *   creemApiKey: '...',
 *   datafastApiKey: '...',
 *   webhookSecret: '...',
 *   getRawBody: () => rawBodyString,
 *   getHeaders: () => requestHeaders,
 * });
 * ```
 */
export async function handleGenericWebhook(
  options: GenericWebhookHandlerOptions
): Promise<{ success: boolean; message: string }> {
  const handler = createWebhookHandler({
    creemApiKey: options.creemApiKey,
    datafastApiKey: options.datafastApiKey,
    webhookSecret: options.webhookSecret,
    cookieName: options.cookieName,
    onPaymentSuccess: options.onPaymentSuccess,
    onError: options.onError,
  });

  const headers = options.getHeaders();
  const signature = headers['creem-signature'] as string | undefined;
  const body = await options.getRawBody();

  return handler.handleWebhook(body, signature);
}

export default handleGenericWebhook;
