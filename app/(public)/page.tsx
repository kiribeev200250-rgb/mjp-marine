import { prisma } from '@/lib/prisma';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import WhyUs from '@/components/landing/WhyUs';
import Services from '@/components/landing/Services';
import HowItWorks from '@/components/landing/HowItWorks';
import Testimonials from '@/components/landing/Testimonials';
import ContactSection from '@/components/landing/ContactSection';
import Subscribe from '@/components/landing/Subscribe';
import Footer from '@/components/landing/Footer';
import WhatsAppButton from '@/components/landing/WhatsAppButton';

export const revalidate = 60;

async function getData() {
  try {
    const [config, services, testimonials] = await Promise.all([
      prisma.siteConfig.findUnique({ where: { id: 1 } }),
      prisma.service.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.testimonial.findMany({ where: { visible: true }, orderBy: { id: 'asc' } }),
    ]);
    return { config, services, testimonials };
  } catch {
    return { config: null, services: [], testimonials: [] };
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
};

export default async function LandingPage() {
  const { config, services, testimonials } = await getData();
  const cfg = config ?? defaultConfig;

  return (
    <>
      <Navbar logoUrl={cfg.logoUrl} />
      <main>
        <Hero />
        <WhyUs />
        <Services services={services.length > 0 ? services : undefined} />
        <HowItWorks />
        {testimonials.length > 0 && <Testimonials testimonials={testimonials} />}
        <Subscribe />
        <ContactSection config={cfg} />
      </main>
      <Footer config={cfg} />
      <WhatsAppButton number={cfg.whatsapp} />
    </>
  );
}
