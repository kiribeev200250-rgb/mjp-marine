'use client';

import { useEffect, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

interface Testimonial {
  id: number;
  name: string;
  boatType: string;
  marina: string;
  rating: number;
  textEn: string;
  textEs: string;
  textRu: string;
  textUk: string;
}

const titleByLang: Record<Lang, string> = {
  en: 'What Our Clients Say',
  es: 'Lo Que Dicen Nuestros Clientes',
  ru: 'Отзывы наших клиентов',
  uk: 'Відгуки наших клієнтів',
};

function getText(t: Testimonial, lang: Lang) {
  return { en: t.textEn, es: t.textEs, ru: t.textRu, uk: t.textUk }[lang];
}

export default function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    setLangState(detectLang());
    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem('lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3" data-i18n="testimonials.title">
            {titleByLang[lang]}
          </h2>
          <div className="w-16 h-1 bg-gold mx-auto rounded-full" />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.id} className="card relative">
              {/* Quote mark */}
              <div className="absolute top-4 right-6 text-5xl text-gold/10 font-serif leading-none">"</div>

              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < t.rating ? 'text-gold' : 'text-gray-200'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">
                &ldquo;{getText(t, lang)}&rdquo;
              </p>

              <div className="border-t border-gray-100 pt-4">
                <p className="font-semibold text-navy text-sm">{t.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{t.boatType} · {t.marina}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
