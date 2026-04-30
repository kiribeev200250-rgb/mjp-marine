import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 4,
  color: { dark: '#C9A84C', light: '#0A2342' },
};

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'png';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? 'localhost';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const url = `${siteUrl}/go`;

  if (format === 'svg') {
    const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' });
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': 'attachment; filename="qr.svg"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const buffer = await QRCode.toBuffer(url, { ...QR_OPTIONS, width: 1024 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="qr.png"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
