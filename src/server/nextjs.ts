import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { WebhookHandlerOptions } from '../types/index.js';

export interface NextJsWebhookOptions extends WebhookHandlerOptions {}

export async function creemDataFastWebhookHandler(
  req: NextRequest,
  options: NextJsWebhookOptions
): Promise<NextResponse> {
  try {
    const signature = req.headers.get('creem-signature') || undefined;
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json(
        { status: 'error', message: 'Missing creem-signature header' },
        { status: 400 }
      );
    }

    console.log(`Webhook received, signature: ${signature ? 'present' : 'missing'}`);

    return NextResponse.json({ 
      status: 'ok', 
      message: 'Webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', message);
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}

export function createNextJsWebhookHandler(options: NextJsWebhookOptions) {
  return (req: NextRequest) => creemDataFastWebhookHandler(req, options);
}

export default creemDataFastWebhookHandler;