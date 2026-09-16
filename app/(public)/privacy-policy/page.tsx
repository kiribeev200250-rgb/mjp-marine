import { Suspense } from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy / Política de privacidad — MJP Marine Service',
  description: 'How MJP Marine Service collects, uses and protects your personal data.',
};

const defaultConfig = {
  companyName: 'MJP Marine Service',
  instagram: '',
  facebook: '',
  whatsapp: '',
  whatsappUrl: '',
  tiktok: '',
  youtube: '',
  logoUrl: null,
  footerBgColor: null,
  footerShowBrand: true,
  footerShowNav: true,
  footerShowSocial: true,
  footerCustomLinks: '[]',
};

async function getConfig() {
  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    return { ...defaultConfig, ...config };
  } catch {
    return defaultConfig;
  }
}

// Публичная страница без авторизации (требование Facebook Lead Ads —
// ссылка на политику должна быть реально доступна). Живёт в той же
// (public) route group, что и лендинг — получает PixelGate/CookieConsent
// из общего app/(public)/layout.tsx.
export default async function PrivacyPolicyPage() {
  const cfg = await getConfig();

  return (
    <>
      <Navbar logoUrl={cfg.logoUrl} />
      <Suspense fallback={null}>
        <PrivacyPolicyContent />
      </Suspense>
      <Footer config={cfg} />
    </>
  );
}
