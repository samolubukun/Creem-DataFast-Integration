import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { WebhookHandlerOptions } from '../types/index.js';

export interface NextJsWebhookOptions extends WebhookHandlerOptions {}

export async function creemDataFastWebhookHandler(
  req: NextRequest,
  _options?: WebhookHandlerOptions
): Promise<NextResponse> {
  try {
    const signature = req.headers.get('creem-signature') || req.headers.get('creem-signature'.toLowerCase()) || undefined;
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json(
        { status: 'error', message: 'Missing creem-signature header' },
        { status: 400 }
      );
    }

    const body = JSON.parse(rawBody);
    const eventType = body.eventType || body.event_type;
    const eventId = body.id;

    console.log(`Received webhook: ${eventType} (${eventId})`);

    return NextResponse.json({ status: 'ok', eventType, eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', message);
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}

export function createNextJsWebhookHandler(options: WebhookHandlerOptions) {
  return (req: NextRequest) => creemDataFastWebhookHandler(req, options);
}

export default creemDataFastWebhookHandler;