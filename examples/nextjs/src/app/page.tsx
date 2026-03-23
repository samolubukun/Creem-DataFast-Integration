'use client';

import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  // ── Pattern B: explicit visitor ID from browser ───────────────────────────
  // Reads the cookie first, then falls back to a URL query param.
  // Use this when you need to send the ID from the client (e.g. to a custom
  // checkout endpoint that requires it in the request body).
  const startCheckoutManual = async () => {
    setLoading(true);

    // Cookie first, then URL query param fallback (e.g. ?datafast_visitor_id=...)
    const urlId = new URLSearchParams(window.location.search).get('datafast_visitor_id');
    const cookieId =
      document.cookie
        .split('; ')
        .find(c => c.startsWith('datafast_visitor_id='))
        ?.split('=')[1] ?? null;
    const visitorId = cookieId ?? urlId;

    console.log('DataFast Visitor ID:', visitorId);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '800px',
        margin: '50px auto',
        padding: '20px',
      }}
    >
      <div style={{ background: '#f5f5f5', padding: '30px', borderRadius: '8px' }}>
        <h1>CREEM + DataFast Integration (Next.js)</h1>
        <p>
          This example demonstrates automatic revenue attribution between CREEM and DataFast.
        </p>

        <div
          style={{
            background: '#e7f3ff',
            padding: '15px',
            borderRadius: '4px',
            margin: '20px 0',
          }}
        >
          <strong>Pattern A — server-side cookie reading (recommended):</strong>
          <ul>
            <li>
              The server reads <code>datafast_visitor_id</code> from the cookie jar automatically
            </li>
            <li>No client-side JavaScript needed to pass the visitor ID</li>
            <li>Works with both cookies and the DataFast session cookie</li>
          </ul>
        </div>

        {/* Pattern A: plain POST — the route handler reads cookies server-side */}
        <form action="/api/checkout" method="POST" style={{ display: 'inline' }}>
          <button
            type="submit"
            style={{
              background: '#0066cc',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              fontSize: '16px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Buy Now — server-side cookies
          </button>
        </form>

        <div
          style={{
            background: '#fff8e1',
            padding: '15px',
            borderRadius: '4px',
            margin: '20px 0',
            fontSize: '14px',
          }}
        >
          <strong>Pattern B — explicit visitor ID from the browser:</strong>
          <ul>
            <li>
              Reads the cookie or URL query param (<code>?datafast_visitor_id=…</code>) in JS
            </li>
            <li>
              Useful when you control the checkout flow client-side or need the ID before
              a server render
            </li>
          </ul>
        </div>

        {/* Pattern B: JS reads the ID and sends it explicitly */}
        <button
          onClick={startCheckoutManual}
          disabled={loading}
          style={{
            background: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating Checkout…' : 'Buy Now — explicit visitor ID'}
        </button>

        <p>
          <small>Product: Premium Plan | Check the browser console for debug info</small>
        </p>
      </div>
    </main>
  );
}
