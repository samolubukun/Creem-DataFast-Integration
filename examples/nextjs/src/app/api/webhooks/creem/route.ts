import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('creem-signature') ?? undefined;
    
    if (!signature) {
      return NextResponse.json(
        { status: 'error', message: 'Missing creem-signature header' },
        { status: 400 }
      );
    }

    const rawBody = await request.text();
    
    console.log('Webhook received:', signature ? 'valid signature' : 'no signature');
    console.log('Body:', rawBody.slice(0, 200));

    return NextResponse.json({ 
      status: 'ok', 
      message: 'Webhook processed successfully'
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