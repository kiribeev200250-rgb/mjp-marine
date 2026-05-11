'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

interface Service {
  id: number;
  icon: string;
  nameEn: string;
  nameEs: string;
  nameRu: string;
  nameUk: string;
  descEn: string;
  descEs: string;
  descRu: string;
  descUk: string;
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

function getServiceName(s: Service, lang: Lang) {
  return { en: s.nameEn, es: s.nameEs, ru: s.nameRu, uk: s.nameUk }[lang];
}
function getServiceDesc(s: Service, lang: Lang) {
  return { en: s.descEn, es: s.descEs, ru: s.descRu, uk: s.descUk }[lang];
}

const sectionTitles: Record<Lang, { title: string; subtitle: string }> = {
  en: { title: 'Our Services', subtitle: 'Everything your boat needs, delivered to your marina.' },
  es: { title: 'Nuestros Servicios', subtitle: 'Todo lo que tu barco necesita, en tu marina.' },
  ru: { title: 'Наши услуги', subtitle: 'Всё необходимое для вашей лодки — прямо у причала.' },
  uk: { title: 'Наші послуги', subtitle: 'Все необхідне для вашого човна — прямо у марині.' },
};

function getGridClass(count: number): string {
  if (count === 1) return 'grid grid-cols-1 max-w-sm mx-auto';
  if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
  if (count <= 4) return 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto';
  return 'grid sm:grid-cols-2 lg:grid-cols-3';
}

function getCardClass(style: string): string {
  switch (style) {
    case 'filled':
      return 'bg-navy text-white rounded-2xl p-6 shadow-sm border border-navy hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group card-shimmer cursor-default';
    case 'minimal':
      return 'rounded-2xl p-6 hover:bg-beige transition-all duration-300 group border border-transparent hover:border-beige-dark hover:-translate-y-1 hover:shadow-md card-shimmer cursor-default';
    default:
      return 'bg-beige rounded-2xl p-6 shadow-sm border border-beige-dark hover:shadow-lg hover:-translate-y-1 hover:border-orange/40 transition-all duration-300 group card-shimmer cursor-default';
  }
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export default function Services({ services, servicesBgColor, servicesCardStyle, showPriceLabel, showAnimations }: ServicesProps) {
  const [lang, setLangState] = useState<Lang>('en');
  const list = services ?? defaultServices;
  const cardStyle = servicesCardStyle ?? 'bordered';
  const showPrice = showPriceLabel !== false;
  const animate = showAnimations !== false;

  const titleReveal = useReveal();
  const gridReveal = useReveal();

  useEffect(() => {
    const detected = detectLang();
    setLangState(detected);

    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem('lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);

  const sectionStyle = servicesBgColor ? { backgroundColor: servicesBgColor } : undefined;

  return (
    <section id="services" className="py-20 bg-cream" style={sectionStyle}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={titleReveal.ref}
          className={`text-center mb-12 ${animate ? 'reveal' : ''} ${animate && titleReveal.visible ? 'visible' : ''}`}
        >
          <h2 className="section-title mb-3" data-i18n="services.title">
            {sectionTitles[lang].title}
          </h2>
          <div className="w-16 h-1 bg-gradient-to-r from-gold to-orange mx-auto rounded-full mb-4" />
          <p className="text-gray-400 max-w-xl mx-auto" data-i18n="services.subtitle">
            {sectionTitles[lang].subtitle}
          </p>
        </div>

        <div
          ref={gridReveal.ref}
          className={`${getGridClass(list.length)} gap-6 ${animate ? 'reveal-stagger' : ''} ${animate && gridReveal.visible ? 'visible' : ''}`}
        >
          {list.map((service) => (
            <div key={service.id} className={getCardClass(cardStyle)}>
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className={`font-heading text-lg font-bold mb-2 group-hover:text-orange transition-colors ${cardStyle === 'filled' ? 'text-white' : 'text-navy'}`}>
                {getServiceName(service, lang)}
              </h3>
              <p className={`text-sm leading-relaxed mb-4 ${cardStyle === 'filled' ? 'text-gray-300' : 'text-gray-500'}`}>
                {getServiceDesc(service, lang)}
              </p>
              {showPrice && (
                <div className="inline-flex items-center gap-1 text-gold font-bold text-sm">
                  {service.priceLabel}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <a href="#contact" className="btn-primary">
            Request a custom quote →
          </a>
        </div>
      </div>
    </section>
  );
}
