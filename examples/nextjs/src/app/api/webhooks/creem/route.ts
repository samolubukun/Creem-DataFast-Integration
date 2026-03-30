import { NextRequest, NextResponse } from 'next/server';
import { creemDataFastWebhookHandler } from 'creem-datafast-integration/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return creemDataFastWebhookHandler(request, {
    creemApiKey: process.env.CREEM_API_KEY || '',
    creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET || '',
    datafastApiKey: process.env.DATAFAST_API_KEY || '',
    testMode: process.env.CREEM_TEST_MODE === 'true',
  });
}