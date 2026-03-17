import { NextRequest, NextResponse } from 'next/server';
import { createCreemDataFast } from 'creem-datafast-integration';

const creemDataFast = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { checkoutUrl } = await creemDataFast.createCheckout(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${request.nextUrl.origin}/success`,
      },
      { request }
    );

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
