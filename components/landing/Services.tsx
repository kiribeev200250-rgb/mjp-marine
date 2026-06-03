'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

interface Service {
  id: number;
  icon: string;
  nameEn: string; nameEs: string; nameRu: string; nameUk: string;
  descEn: string; descEs: string; descRu: string; descUk: string;
  priceLabel: string;
}

interface ServicesProps {
  services?: Service[];
  servicesBgColor?: string | null;
  servicesCardStyle?: string | null;
  showPriceLabel?: boolean | null;
  showAnimations?: boolean | null;
}

const defaultServices: Service[] = [
  { id: 1, icon: '✨', nameEn: 'Hull Polishing & Gelcoat', nameEs: 'Pulido de Casco', nameRu: 'Полировка корпуса', nameUk: 'Полірування корпусу', descEn: 'Restore your hull to showroom shine.', descEs: 'Restaura tu casco al brillo original.', descRu: 'Восстановите блеск корпуса.', descUk: 'Відновіть блиск корпусу.', priceLabel: 'from €180' },
  { id: 2, icon: '⚙️', nameEn: 'Engine Service', nameEs: 'Servicio de Motor', nameRu: 'Обслуживание двигателя', nameUk: 'Обслуговування двигуна', descEn: 'Full engine servicing, oil changes, impeller replacement.', descEs: 'Servicio completo de motor y cambios de aceite.', descRu: 'Полное техническое обслуживание двигателя.', descUk: 'Повне технічне обслуговування двигуна.', priceLabel: 'from €220' },
  { id: 3, icon: '⚡', nameEn: 'Electrics & Navigation', nameEs: 'Eléctrica y Navegación', nameRu: 'Электрика и навигация', nameUk: 'Електрика та навігація', descEn: 'Wiring, battery banks, chart plotters, VHF radios.', descEs: 'Cableado, baterías, plotters, radios VHF.', descRu: 'Проводка, аккумуляторы, плоттеры, VHF-радио.', descUk: 'Проводка, акумулятори, плотери, VHF-радіо.', priceLabel: 'from €40/h' },
  { id: 4, icon: '🔧', nameEn: 'Plumbing & Pumps', nameEs: 'Fontanería y Bombas', nameRu: 'Сантехника и помпы', nameUk: 'Сантехніка та помпи', descEn: 'Bilge pumps, water makers, through-hulls, hoses.', descEs: 'Bombas de sentina, pasamuros, mangueras.', descRu: 'Трюмные помпы, кингстоны, шланги.', descUk: 'Трюмні помпи, кінгстони, шланги.', priceLabel: 'from €80' },
  { id: 5, icon: '🛡️', nameEn: 'Antifouling & Anodes', nameEs: 'Antifouling y Ánodos', nameRu: 'Необрастающее и аноды', nameUk: 'Протиобростання та аноди', descEn: 'Bottom paint application, zinc and aluminum anode replacement.', descEs: 'Pintura de fondo y sustitución de ánodos.', descRu: 'Нанесение необрастающей краски и замена анодов.', descUk: 'Нанесення протиобростаючої фарби та заміна анодів.', priceLabel: 'from €350' },
  { id: 6, icon: '⛵', nameEn: 'Season Prep Package', nameEs: 'Paquete de Puesta a Punto', nameRu: 'Пакет подготовки к сезону', nameUk: 'Пакет підготовки до сезону', descEn: 'Complete pre-season service: engine, electrics, hull, safety.', descEs: 'Servicio completo previo a temporada.', descRu: 'Полное предсезонное обслуживание.', descUk: 'Повне передсезонне обслуговування.', priceLabel: 'from €590' },
];

const sectionTitles: Record<Lang, { title: string; subtitle: string }> = {
  en: { title: 'Our Services', subtitle: 'Everything your boat needs, delivered to your marina.' },
  es: { title: 'Nuestros Servicios', subtitle: 'Todo lo que tu barco necesita, en tu marina.' },
  ru: { title: 'Наши услуги', subtitle: 'Всё необходимое для вашей лодки — прямо у причала.' },
  uk: { title: 'Наші послуги', subtitle: 'Все необхідне для вашого човна — прямо у марині.' },
};

const quoteLinkLabel: Record<Lang, string> = {
  en: 'Request a custom quote →',
  es: 'Solicitar un presupuesto personalizado →',
  ru: 'Запросить индивидуальную смету →',
  uk: 'Запросити індивідуальний кошторис →',
};

function getName(s: Service, lang: Lang) {
  return { en: s.nameEn, es: s.nameEs, ru: s.nameRu, uk: s.nameUk }[lang];
}
function getDesc(s: Service, lang: Lang) {
  return { en: s.descEn, es: s.descEs, ru: s.descRu, uk: s.descUk }[lang];
}

function getGridClass(count: number): string {
  if (count === 1) return 'grid grid-cols-1 max-w-sm mx-auto';
  if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
  if (count <= 4) return 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto';
  return 'grid sm:grid-cols-2 lg:grid-cols-3';
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

export default function Services({ services, servicesBgColor, showPriceLabel, showAnimations }: ServicesProps) {
  const [lang, setLangState] = useState<Lang>('en');
  const list = services ?? defaultServices;
  const showPrice = showPriceLabel !== false;
  const animate = showAnimations !== false;

  const titleReveal = useReveal();
  const gridReveal = useReveal();

  useEffect(() => {
    setLangState(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  const sectionBg = servicesBgColor ?? '#F5F0E8';
  const titles = sectionTitles[lang];

  return (
    <section id="services" style={{ backgroundColor: sectionBg, paddingTop: '5rem', paddingBottom: '5rem' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div
          ref={titleReveal.ref}
          className={`text-center mb-14 ${animate ? 'reveal' : ''} ${animate && titleReveal.visible ? 'visible' : ''}`}
        >
          <p className="label-caps mb-3" style={{ color: '#A8893A' }}>What we do</p>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontWeight: 600,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#0A2342',
              lineHeight: 1.1,
              marginBottom: '1rem',
            }}
            data-i18n="services.title"
          >
            {titles.title}
          </h2>
          <div style={{ width: 48, height: 1, background: '#C9A84C', margin: '0 auto 1rem' }} />
          <p
            style={{ color: '#6b7280', maxWidth: '36rem', margin: '0 auto', fontFamily: 'Mulish, sans-serif', fontWeight: 300, fontSize: '1.05rem' }}
            data-i18n="services.subtitle"
          >
            {titles.subtitle}
          </p>
        </div>

        {/* Grid */}
        <div
          ref={gridReveal.ref}
          className={`${getGridClass(list.length)} gap-6 ${animate ? 'reveal-stagger' : ''} ${animate && gridReveal.visible ? 'visible' : ''}`}
        >
          {list.map((service) => (
            <ServiceCard key={service.id} service={service} lang={lang} showPrice={showPrice} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a href="#contact" className="btn-gold">
            {quoteLinkLabel[lang]}
          </a>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ service, lang, showPrice }: { service: Service; lang: Lang; showPrice: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        borderRadius: 0,
        padding: '2rem',
        borderTop: hovered ? '3px solid #C9A84C' : '1px solid rgba(201,168,76,0.4)',
        borderRight: '1px solid rgba(201,168,76,0.1)',
        borderBottom: '1px solid rgba(201,168,76,0.1)',
        borderLeft: '1px solid rgba(201,168,76,0.1)',
        transform: hovered ? 'translateY(-6px)' : 'none',
        boxShadow: hovered ? '0 16px 48px rgba(10,35,66,0.12)' : 'none',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-top 0.2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem', lineHeight: 1 }}>
        {service.icon}
      </div>
      <h3
        style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontWeight: 600,
          fontSize: '1.35rem',
          color: hovered ? '#C9A84C' : '#0A2342',
          marginBottom: '0.75rem',
          transition: 'color 0.2s ease',
          lineHeight: 1.2,
        }}
      >
        {getName(service, lang)}
      </h3>
      <p
        style={{
          fontFamily: 'Mulish, sans-serif',
          fontWeight: 300,
          fontSize: '0.9rem',
          color: '#6b7280',
          lineHeight: 1.65,
          marginBottom: showPrice ? '1.25rem' : 0,
        }}
      >
        {getDesc(service, lang)}
      </p>
      {showPrice && (
        <div
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#C9A84C',
            letterSpacing: '0.02em',
          }}
        >
          {service.priceLabel}
        </div>
      )}
    </div>
  );
}