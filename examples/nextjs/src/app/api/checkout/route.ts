import { NextRequest, NextResponse } from 'next/server';
import { createCreemDataFastClient } from 'creem-datafast-integration';

const creemClient = createCreemDataFastClient({
  apiKey: process.env.CREEM_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visitorId } = body;

    // The package injects datafast_visitor_id into metadata automatically.
    const checkout = await creemClient.createCheckoutWithVisitorId(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${request.nextUrl.origin}/success`,
      },
      visitorId ?? null
    );

    return NextResponse.json({
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
