import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createWebhookHandler } from './webhook-handler.js';
import type { WebhookHandlerOptions } from '../types/index.js';

export interface NextJsWebhookOptions extends WebhookHandlerOptions {}

/**
 * Handle a CREEM webhook inside a Next.js App Router `POST` handler.
 *
 * ```ts
 * // app/api/webhooks/creem/route.ts
 * import { creemDataFastWebhookHandler } from 'creem-datafast';
 *
 * export async function POST(request: NextRequest) {
 *   return creemDataFastWebhookHandler(request, { ... });
 * }
 * ```
 */
export async function creemDataFastWebhookHandler(
  req: NextRequest,
  options: NextJsWebhookOptions
): Promise<NextResponse> {
  try {
    const handler = createWebhookHandler(options);

    const signature = req.headers.get('creem-signature') || undefined;
    const rawBody = await req.text();

    const result = await handler.handleWebhook(rawBody, signature);

    if (result.success) {
      return NextResponse.json({ status: 'ok', message: result.message });
    }

    return NextResponse.json(
      { status: 'error', message: result.message },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}

/**
 * Create a reusable Next.js POST handler with baked-in options.
 */
export function createNextJsWebhookHandler(options: NextJsWebhookOptions) {
  return (req: NextRequest) => creemDataFastWebhookHandler(req, options);
}

export default creemDataFastWebhookHandler;
