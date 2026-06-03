'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

interface Testimonial {
  id: number;
  name: string;
  boatType: string;
  marina: string;
  rating: number;
  textEn: string; textEs: string; textRu: string; textUk: string;
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

interface TestimonialsProps {
  testimonials: Testimonial[];
  showAnimations?: boolean | null;
}

export default function Testimonials({ testimonials, showAnimations }: TestimonialsProps) {
  const [lang, setLangState] = useState<Lang>('en');
  const animate = showAnimations !== false;
  const titleRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [titleVisible, setTitleVisible] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!animate) { setTitleVisible(true); setGridVisible(true); return; }
    const observe = (el: HTMLElement | null, setter: (v: boolean) => void) => {
      if (!el) return;
      const io = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) { setter(true); io.disconnect(); } },
        { threshold: 0.12 }
      );
      io.observe(el);
      return () => io.disconnect();
    };
    const d1 = observe(titleRef.current, setTitleVisible);
    const d2 = observe(gridRef.current, setGridVisible);
    return () => { d1?.(); d2?.(); };
  }, [animate]);

  return (
    <section style={{ background: '#F5F0E8', paddingTop: '5rem', paddingBottom: '5rem' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div
          ref={titleRef}
          className={`text-center mb-14 ${animate ? 'reveal' : ''} ${animate && titleVisible ? 'visible' : ''}`}
        >
          <p className="label-caps mb-3" style={{ color: '#A8893A' }}>Client stories</p>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontWeight: 600,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#0A2342',
              lineHeight: 1.1,
              marginBottom: '1rem',
            }}
            data-i18n="testimonials.title"
          >
            {titleByLang[lang]}
          </h2>
          <div style={{ width: 48, height: 1, background: '#C9A84C', margin: '0 auto' }} />
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className={`grid md:grid-cols-3 gap-6 ${animate ? 'reveal-stagger' : ''} ${animate && gridVisible ? 'visible' : ''}`}
        >
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial: t, lang }: { testimonial: Testimonial; lang: Lang }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 0,
        padding: '2rem',
        borderLeft: '3px solid #C9A84C',
        borderTop: '1px solid rgba(201,168,76,0.1)',
        borderRight: '1px solid rgba(201,168,76,0.1)',
        borderBottom: '1px solid rgba(201,168,76,0.1)',
        position: 'relative',
      }}
    >
      {/* Large quotation mark */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1.25rem',
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '4rem',
          lineHeight: 1,
          color: 'rgba(201,168,76,0.12)',
          userSelect: 'none',
        }}
      >
        &ldquo;
      </div>

      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            style={{ fontSize: '0.9rem', color: i < t.rating ? '#C9A84C' : '#e5e7eb' }}
          >
            ★
          </span>
        ))}
      </div>

      {/* Quote text */}
      <p
        style={{
          fontFamily: 'Mulish, sans-serif',
          fontWeight: 300,
          fontStyle: 'italic',
          fontSize: '0.95rem',
          lineHeight: 1.7,
          color: '#374151',
          marginBottom: '1.5rem',
        }}
      >
        &ldquo;{getText(t, lang)}&rdquo;
      </p>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(201,168,76,0.2)', marginBottom: '1rem' }} />

      {/* Author */}
      <div>
        <p style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#0A2342' }}>
          {t.name}
        </p>
        <p style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 300, fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.2rem' }}>
          {t.boatType} · {t.marina}
        </p>
      </div>
    </div>
  );
}