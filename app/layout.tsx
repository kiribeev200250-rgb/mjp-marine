import type { Metadata } from 'next';
import './globals.css';
import { prisma } from '@/lib/prisma';

const defaultMeta = {
  title: 'MJP Marine Service — Mobile Yacht Repair Costa Blanca',
  description: 'Mobile yacht repair & maintenance in Costa Blanca. We come to your marina. 48h response. Alicante · Dénia · Torrevieja.',
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    return {
      title: cfg?.metaTitle ?? defaultMeta.title,
      description: cfg?.metaDesc ?? defaultMeta.description,
      openGraph: {
        title: cfg?.metaTitle ?? defaultMeta.title,
        description: cfg?.metaDesc ?? defaultMeta.description,
        type: 'website',
      },
      icons: { icon: cfg?.faviconUrl ?? '/favicon.svg' },
    };
  } catch {
    return {
      ...defaultMeta,
      openGraph: { title: defaultMeta.title, description: defaultMeta.description, type: 'website' },
      icons: { icon: '/favicon.svg' },
    };
  }
}

async function getCssVars(): Promise<string> {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    const primary = cfg?.colorPrimary ?? '#0A2342';
    const accent = cfg?.colorAccent ?? '#C9A84C';
    const text = cfg?.colorText ?? '#FFFFFF';
    return `:root{--color-primary:${primary};--color-accent:${accent};--color-text:${text};}`;
  } catch {
    return ':root{--color-primary:#0A2342;--color-accent:#C9A84C;--color-text:#FFFFFF;}';
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cssVars = await getCssVars();
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
