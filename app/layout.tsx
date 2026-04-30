import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MJP Marine Service — Mobile Yacht Repair Costa Blanca',
  description: 'Mobile yacht repair & maintenance in Costa Blanca. We come to your marina. 48h response. Alicante · Dénia · Torrevieja.',
  openGraph: {
    title: 'MJP Marine Service — Mobile Yacht Repair Costa Blanca',
    description: 'Mobile yacht repair & maintenance in Costa Blanca. We come to your marina. 48h response.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
