'use client';

import { useEffect, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

const badges = [
  { icon: '⚓', key: 'trust.badge1', defaults: { en: 'Licensed & Insured', es: 'Con Licencia y Seguro', ru: 'Лицензированные', uk: 'Ліцензовані' } },
  { icon: '🔧', key: 'trust.badge2', defaults: { en: '5+ Years Experience', es: '5+ Años de Experiencia', ru: '5+ Лет опыта', uk: '5+ Років досвіду' } },
  { icon: '⏱', key: 'trust.badge3', defaults: { en: '48h Guarantee', es: 'Garantía 48h', ru: 'Гарантия 48ч', uk: 'Гарантія 48г' } },
  { icon: '📍', key: 'trust.badge4', defaults: { en: '20+ Marinas', es: '20+ Marinas', ru: '20+ Марин', uk: '20+ Марин' } },
];

export default function TrustBadges() {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    setLang(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLang(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="relative"
      style={{
        background: '#0D2D4A',
        borderTop: '1px solid rgba(201,168,76,0.2)',
        borderBottom: '1px solid rgba(201,168,76,0.2)',
      }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {badges.map((badge, i) => (
            <div
              key={badge.key}
              className="flex items-center justify-center gap-3 py-5 px-4"
              style={{
                borderRight: i < badges.length - 1 ? '1px solid rgba(201,168,76,0.2)' : 'none',
              }}
            >
              <span className="text-xl flex-shrink-0">{badge.icon}</span>
              <span
                className="label-caps text-white/70"
                data-i18n={badge.key}
              >
                {badge.defaults[lang]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}