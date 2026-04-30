'use client';

import { useEffect, useState } from 'react';
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

export default function Services({ services }: { services?: Service[] }) {
  const [lang, setLangState] = useState<Lang>('en');
  const list = services ?? defaultServices;

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

  return (
    <section id="services" className="py-20 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3" data-i18n="services.title">
            {sectionTitles[lang].title}
          </h2>
          <div className="w-16 h-1 bg-gradient-to-r from-gold to-orange mx-auto rounded-full mb-4" />
          <p className="text-gray-400 max-w-xl mx-auto" data-i18n="services.subtitle">
            {sectionTitles[lang].subtitle}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((service) => (
            <div
              key={service.id}
              className="bg-beige rounded-2xl p-6 shadow-sm border border-beige-dark hover:shadow-md hover:border-orange/40 transition-all duration-300 group"
            >
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="font-heading text-lg font-bold text-navy mb-2 group-hover:text-orange transition-colors">
                {getServiceName(service, lang)}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                {getServiceDesc(service, lang)}
              </p>
              <div className="inline-flex items-center gap-1 text-gold font-bold text-sm">
                {service.priceLabel}
              </div>
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
