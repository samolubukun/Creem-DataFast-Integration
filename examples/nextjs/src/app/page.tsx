'use client';

import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const startCheckout = async () => {
    setLoading(true);
    const visitorId = getCookie('datafast_visitor_id');
    console.log('DataFast Visitor ID:', visitorId);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId })
      });

      const data = await response.json();
      console.log('Checkout response:', data);

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
    <main style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px'
    }}>
      <div style={{ background: '#f5f5f5', padding: '30px', borderRadius: '8px' }}>
        <h1>CREEM + DataFast Integration (Next.js)</h1>
        <p>This example demonstrates automatic revenue attribution between CREEM and DataFast.</p>

        <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '4px', margin: '20px 0' }}>
          <strong>How it works:</strong>
          <ul>
            <li>DataFast visitor ID is automatically captured from cookies</li>
            <li>When checkout completes, payment data is sent to DataFast</li>
            <li>Revenue is attributed to the correct traffic source</li>
          </ul>
        </div>

        <button
          onClick={startCheckout}
          disabled={loading}
          style={{
            background: loading ? '#ccc' : '#0066cc',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Creating Checkout...' : 'Buy Now - $29.99'}
        </button>

        <p><small>Product: Premium Plan | Check console for debug info</small></p>
      </div>
    </main>
  );
}
