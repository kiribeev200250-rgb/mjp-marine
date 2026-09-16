import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import PixelGate from '@/components/consent/PixelGate';
import CookieConsent from '@/components/consent/CookieConsent';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = await prisma.presiteConfig.findUnique({ where: { id: 1 } });
    return {
      title: config?.pageTitle ?? 'MJP Marine Service',
      description: config?.taglineEn ?? 'Mobile Yacht Repair · Costa Blanca',
    };
  } catch {
    return { title: 'MJP Marine Service' };
  }
}

// Пиксели гейтятся согласием (см. lib/consent.ts) — раньше грузились
// безусловно, до какого-либо согласия пользователя. /go — presite-лендинги
// под QR/рекламу, тот же источник трафика, что и основной сайт, поэтому тот
// же баннер согласия здесь тоже нужен (без него пиксели никогда не получат
// согласия у прямых переходов по QR, реклама перестанет измеряться).
export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PixelGate />
      {children}
      <CookieConsent />
    </>
  );
}
