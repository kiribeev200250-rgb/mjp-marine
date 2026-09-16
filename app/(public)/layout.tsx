import PixelGate from '@/components/consent/PixelGate';
import CookieConsent from '@/components/consent/CookieConsent';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PixelGate />
      {children}
      <CookieConsent />
    </>
  );
}
