import { prisma } from '@/lib/prisma';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import TrustBadges from '@/components/landing/TrustBadges';
import Services from '@/components/landing/Services';
import HowItWorks from '@/components/landing/HowItWorks';
import CoverageMap from '@/components/landing/CoverageMap';
import Testimonials from '@/components/landing/Testimonials';
import Gallery from '@/components/landing/Gallery';
import ContactSection from '@/components/landing/ContactSection';
import Subscribe from '@/components/landing/Subscribe';
import Footer from '@/components/landing/Footer';
import WhatsAppButton from '@/components/landing/WhatsAppButton';

export const revalidate = 60;

async function getData() {
  try {
    const [config, services, testimonials, galleryItems] = await Promise.all([
      prisma.siteConfig.findUnique({ where: { id: 1 } }),
      prisma.service.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.testimonial.findMany({ where: { visible: true }, orderBy: { id: 'asc' } }),
      prisma.galleryItem.findMany({ where: { visible: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    return { config, services, testimonials, galleryItems };
  } catch {
    return { config: null, services: [], testimonials: [], galleryItems: [] };
  }
}

const defaultConfig = {
  companyName: 'MJP Marine Service',
  phone: '+34 600 000 000',
  whatsapp: '+34600000000',
  email: 'info@mjpmarine.es',
  hours: 'Mon–Sat 8:00–19:00',
  coverage: 'Costa Blanca — Alicante · Dénia · Torrevieja',
  instagram: '',
  facebook: '',
  whatsappUrl: '',
  tiktok: '',
  youtube: '',
  logoUrl: null,
  heroBgUrl: null,
  heroOverlayOpacity: 0.75,
  showHeroStats: true,
  heroAnimation: 'none',
  servicesBgColor: null,
  servicesCardStyle: 'bordered',
  showPriceLabel: true,
  footerBgColor: null,
  footerShowBrand: true,
  footerShowNav: true,
  footerShowSocial: true,
  footerCustomLinks: '[]',
  showGallery: false,
  showAnimations: true,
  showWave: true,
};

export default async function LandingPage() {
  const { config, services, testimonials, galleryItems } = await getData();
  const cfg = { ...defaultConfig, ...config };

  return (
    <>
      <Navbar logoUrl={cfg.logoUrl} />
      <main>
        <Hero
          heroBgUrl={cfg.heroBgUrl}
          heroOverlayOpacity={cfg.heroOverlayOpacity}
          showHeroStats={cfg.showHeroStats}
          heroAnimation={cfg.heroAnimation}
          showWave={cfg.showWave}
          showAnimations={cfg.showAnimations}
        />
        <TrustBadges />
        <Services
          services={services.length > 0 ? services : undefined}
          servicesBgColor={cfg.servicesBgColor}
          servicesCardStyle={cfg.servicesCardStyle}
          showPriceLabel={cfg.showPriceLabel}
          showAnimations={cfg.showAnimations}
        />
        <HowItWorks showAnimations={cfg.showAnimations} />
        <CoverageMap />
        {testimonials.length > 0 && (
          <Testimonials testimonials={testimonials} showAnimations={cfg.showAnimations} />
        )}
        {cfg.showGallery && galleryItems.length > 0 && (
          <Gallery items={galleryItems} showAnimations={cfg.showAnimations} />
        )}
        <Subscribe />
        <ContactSection config={cfg} showAnimations={cfg.showAnimations} />
      </main>
      <Footer config={cfg} />
      <WhatsAppButton number={cfg.whatsapp} />
    </>
  );
}