import { NextRequest, NextResponse } from 'next/server';
import { createCreemDataFastClient, getVisitorIdFromUrl } from 'creem-datafast-integration';
import { cookies } from 'next/headers';

const client = createCreemDataFastClient({
  apiKey: process.env.CREEM_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    // ── Pattern A: server-side cookie reading (recommended) ──────────────────
    // The package reads datafast_visitor_id (and datafast_session_id) from the
    // cookie jar automatically. No client-side JS required.
    const cookieStore = await cookies();
    const cookieObj = Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value]));

    const checkout = await client.createCheckout(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${request.nextUrl.origin}/success`,
      },
      cookieObj   // ← automatic: reads datafast_visitor_id + datafast_session_id
    );

    return NextResponse.json({
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
    });

    // ── Pattern B: explicit visitor ID (alternative) ─────────────────────────
    // Use this when the ID comes from a URL query param, a custom header, or
    // any source other than cookies (e.g. server-side rendering, email links).
    //
    // const body = await request.json();
    // const idFromBody  = body.visitorId ?? null;
    // const idFromUrl   = getVisitorIdFromUrl(request.nextUrl.searchParams);
    // const resolvedId  = idFromBody ?? idFromUrl ?? null;
    //
    // const checkout = await client.createCheckoutWithVisitorId(
    //   { productId: process.env.CREEM_PRODUCT_ID!, successUrl: `${request.nextUrl.origin}/success` },
    //   resolvedId
    // );

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
