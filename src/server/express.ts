import type { Request, Response, NextFunction } from 'express';
import { createWebhookHandler } from './webhook-handler.js';
import type { WebhookHandlerOptions } from '../types/index.js';

export interface ExpressWebhookMiddlewareOptions extends WebhookHandlerOptions {}

/**
 * Express middleware that handles incoming CREEM webhooks and forwards
 * payment events to DataFast.
 *
 * **Important:** The request body must be available as a raw string for
 * signature verification.  If you use `express.json()` globally, this
 * middleware will fall back to `JSON.stringify(req.body)`.  For proper
 * signature verification, register a raw body parser on this route:
 *
 * ```ts
 * app.post('/webhooks/creem',
 *   express.raw({ type: 'application/json' }),
 *   creemDataFastWebhook({ ... })
 * );
 * ```
 */
export function creemDataFastWebhook(options: ExpressWebhookMiddlewareOptions) {
  const handler = createWebhookHandler(options);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['creem-signature'] as string | undefined;

      // Prefer the raw buffer if available (from express.raw()), otherwise
      // fall back to stringifying the parsed body.
      let rawBody: string;
      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body.toString('utf-8');
      } else if (typeof req.body === 'string') {
        rawBody = req.body;
      } else {
        rawBody = JSON.stringify(req.body);
      }

      const result = await handler.handleWebhook(rawBody, signature);

      if (result.success) {
        res.status(200).json({ status: 'ok', message: result.message });
      } else {
        res.status(400).json({ status: 'error', message: result.message });
      }
    } catch (error) {
      next(error);
    }
  };
}

export default creemDataFastWebhook;
