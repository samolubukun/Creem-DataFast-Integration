export default function Success() {
  return (
    <main style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '600px',
      margin: '100px auto',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ color: '#28a745', fontSize: '48px', marginBottom: '20px' }}>✓</div>
      <h1>Payment Successful!</h1>
      <p>Thank you for your purchase.</p>
      <p>Your payment has been recorded and revenue attributed to your traffic source.</p>
      <a href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>
        ← Back to Home
      </a>
    </main>
  );
}
