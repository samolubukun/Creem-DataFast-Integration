import { NextRequest, NextResponse } from 'next/server';
import { createCreemDataFast } from 'creem-datafast-integration';

const creemDataFast = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await request.json().catch(() => ({})) : {};
    const visitorId =
      body && typeof body === 'object' && 'visitorId' in body && typeof body.visitorId === 'string'
        ? body.visitorId
        : undefined;

    const { checkoutUrl } = await creemDataFast.createCheckout(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${request.nextUrl.origin}/success`,
        tracking: visitorId ? { visitorId } : undefined,
      },
      { request }
    );

    if (isJson) {
      return NextResponse.json({ checkoutUrl });
    }

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
