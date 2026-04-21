import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CloneCraft AI — Ecommerce Creative Generator',
  description:
    'Generate stunning Amazon & Flipkart product listing creatives using AI. Clone any listing style and adapt it to your own product in minutes.',
  keywords: 'ecommerce creatives, Amazon listing images, Flipkart product images, AI image generator, product photography AI',
  openGraph: {
    title: 'CloneCraft AI',
    description: 'AI-powered ecommerce creative generation tool',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
