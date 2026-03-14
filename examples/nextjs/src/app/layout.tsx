import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'CREEM + DataFast Example',
  description: 'Payment attribution example',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://cdn.datafa.st/tracking.js"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
