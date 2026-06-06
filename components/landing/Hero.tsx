'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';
import { trackTikTokEvent } from '@/lib/tiktok';
import { trackFBEvent } from '@/lib/facebook';

interface HeroProps {
  heroBgUrl?: string | null;
  heroOverlayOpacity?: number | null;
  showHeroStats?: boolean | null;
  heroAnimation?: string | null;
  showWave?: boolean | null;
  showAnimations?: boolean | null;
}

const STATS = [
  { num: 48,  suffix: 'h', label: { en: 'Response Time', es: 'Tiempo de Respuesta', ru: 'Время ответа', uk: 'Час відповіді' } },
  { num: 0,   suffix: '€', label: { en: 'Marina Visit Fee', es: 'Tarifa de Visita', ru: 'Плата за выезд', uk: 'Плата за виїзд' }, prefix: true },
  { num: 20,  suffix: '+', label: { en: 'Marinas Served', es: 'Marinas Atendidas', ru: 'Обслуженных Марин', uk: 'Обслуговуваних Марин' } },
  { num: 50,  suffix: '+', label: { en: 'Service Types', es: 'Tipos de Servicio', ru: 'Видов Услуг', uk: 'Видів Послуг' } },
];

function useCountUp(target: number, duration = 1400, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (target === 0) { setCount(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - prog, 3);
      setCount(Math.round(eased * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return count;
}

function StatItem({ num, suffix, label, prefix, active, lang }: {
  num: number; suffix: string; label: Record<Lang, string>;
  prefix?: boolean; active: boolean; lang: Lang;
}) {
  const count = useCountUp(num, 1400, active);
  return (
    <div className="flex flex-col items-center text-center px-4 py-5 border-r border-gold/20 last:border-r-0">
      <div
        className="leading-none mb-1"
        style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
          fontWeight: 700,
          color: '#C9A84C',
        }}
      >
        {prefix ? `€${count}` : `${count}${suffix}`}
      </div>
      <div className="label-caps text-white/50 mt-1">{label[lang]}</div>
    </div>
  );
}

export default function Hero({
  heroBgUrl,
  heroOverlayOpacity = 0.75,
  showHeroStats = true,
  heroAnimation = 'none',
  showWave = true,
  showAnimations = true,
}: HeroProps) {
  const overlayOpacity = heroOverlayOpacity ?? 0.75;
  const animate = showAnimations !== false;
  const isSplit = heroAnimation === 'split';

  const [lang, setLangState] = useState<Lang>('en');
  const [entered, setEntered] = useState(false);
  const [statsActive, setStatsActive] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

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
    if (!animate) { setEntered(true); setStatsActive(true); return; }
    const t = setTimeout(() => setEntered(true), 150);
    return () => clearTimeout(t);
  }, [animate]);

  useEffect(() => {
    if (!showHeroStats) return;
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsActive(true); io.disconnect(); } },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showHeroStats]);

  const heroContent = (
    <>
      {/* Eyebrow label */}
      <div
        className="inline-flex items-center gap-2 mb-8"
        style={{ opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateY(16px)', transition: 'opacity 0.5s ease, transform 0.5s ease', transitionDelay: '0s' }}
      >
        <span className="w-px h-4 bg-gold/60" />
        <span className="label-caps text-gold/80">Mobile Yacht Service · Costa Blanca</span>
        <span className="w-px h-4 bg-gold/60" />
      </div>

      {/* Headline */}
      <h1
        className="text-white mb-6 leading-tight"
        style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontWeight: 600,
          fontSize: 'clamp(2.5rem, 6vw, 5rem)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'none' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          transitionDelay: '0.1s',
        }}
        data-i18n="hero.h1"
      >
        {lang === 'es'
          ? <>Tu barco reparado, en tu marina.{' '}<span style={{ color: '#C9A84C', display: 'inline-block', position: 'relative' }}>En 48 horas.<UnderlineAnim active={entered} /></span></>
          : lang === 'ru'
            ? <>Ваша яхта отремонтирована прямо у причала.{' '}<span style={{ color: '#C9A84C', display: 'inline-block', position: 'relative' }}>За 48 часов.<UnderlineAnim active={entered} /></span></>
            : lang === 'uk'
              ? <>Ваш човен відремонтований у марині.{' '}<span style={{ color: '#C9A84C', display: 'inline-block', position: 'relative' }}>За 48 годин.<UnderlineAnim active={entered} /></span></>
              : <>Your boat fixed, at your marina.{' '}<span style={{ color: '#C9A84C', display: 'inline-block', position: 'relative' }}>In 48 hours.<UnderlineAnim active={entered} /></span></>
        }
      </h1>

      {/* Subline */}
      <p
        className="text-white/65 mb-10 leading-relaxed"
        style={{
          fontFamily: 'Mulish, sans-serif',
          fontWeight: 300,
          fontSize: 'clamp(1rem, 2vw, 1.2rem)',
          maxWidth: '38rem',
          opacity: entered ? 1 : 0,
          transform: entered ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          transitionDelay: '0.22s',
        }}
        data-i18n="hero.subline"
      >
        {lang === 'es'
          ? 'Servicio móvil de reparación y mantenimiento de yates. Vamos a donde estás — Alicante · Dénia · Torrevieja.'
          : lang === 'ru'
            ? 'Мобильный сервис по ремонту яхт. Мы приезжаем к вам — Аликанте · Дения · Торревьеха.'
            : lang === 'uk'
              ? 'Мобільний сервіс з ремонту яхт. Ми приїжджаємо до вас — Аліканте · Денія · Торревʼєха.'
              : 'Mobile yacht repair & maintenance service. We come to you — Alicante · Dénia · Torrevieja.'}
      </p>

      {/* CTA buttons */}
      <div
        className="flex flex-wrap gap-3"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          transitionDelay: '0.34s',
        }}
      >
        <a href="#contact" className="btn-gold px-8 py-4 text-sm" data-i18n="hero.btn1" onClick={() => {
          trackTikTokEvent('ClickButton', { content_name: 'Request Service Hero' });
          trackFBEvent('InitiateCheckout', { content_name: 'Request Service' });
        }}>
          {lang === 'es' ? 'Solicitar servicio' : lang === 'ru' ? 'Заказать услугу' : lang === 'uk' ? 'Замовити послугу' : 'Request service'}
        </a>
        <a href="#services" className="btn-outline-white px-8 py-4 text-sm" data-i18n="hero.btn2">
          {lang === 'es' ? 'Ver servicios' : lang === 'ru' ? 'Посмотреть услуги' : lang === 'uk' ? 'Переглянути послуги' : 'View services'}
        </a>
      </div>
    </>
  );

  if (isSplit) {
    return (
      <section ref={heroRef} className="relative min-h-screen flex pt-[72px] overflow-hidden">
        {/* Left half */}
        <div className="relative z-10 w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-20 py-20" style={{ background: '#0A2342' }}>
          {heroContent}
          {showHeroStats && (
            <div ref={statsRef} className="mt-12 grid grid-cols-2 gap-0 border border-gold/15" style={{ maxWidth: '28rem' }}>
              {STATS.map((s) => (
                <StatItem key={s.label.en} {...s} active={statsActive} lang={lang} />
              ))}
            </div>
          )}
        </div>

        {/* Diagonal gold divider */}
        <div
          className="hidden md:block absolute top-0 bottom-0 z-10"
          style={{ left: '50%', width: '2px', background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.4), transparent)' }}
        />
        <div
          className="hidden md:block absolute top-0 bottom-0 z-10"
          style={{ left: 'calc(50% - 60px)', width: '1px', background: 'rgba(201,168,76,0.12)' }}
        />

        {/* Right half: yacht image with ken-burns */}
        <div className="hidden md:block w-1/2 relative overflow-hidden">
          {heroBgUrl ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${heroBgUrl}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                animation: 'kenBurns 20s ease-in-out infinite alternate',
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-navy-light to-navy-deep flex items-center justify-center">
              <AnchorWatermark />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'rgba(10,35,66,0.3)' }} />
        </div>

        <style>{`
          @keyframes kenBurns {
            0%   { transform: scale(1) translateX(0); }
            100% { transform: scale(1.08) translateX(-2%); }
          }
        `}</style>
      </section>
    );
  }

  /* Variation A — Full Bleed Dark */
  return (
    <section ref={heroRef} className="relative min-h-screen flex flex-col justify-center overflow-hidden" style={{ paddingTop: '72px' }}>
      {/* Background */}
      {heroBgUrl ? (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url('${heroBgUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ) : (
        <div className="absolute inset-0 bg-navy" />
      )}

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(6,23,41,${overlayOpacity})` }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-20 md:py-28">
        <div className="max-w-3xl">
          {heroContent}
        </div>

        {/* Stats strip */}
        {showHeroStats && (
          <div
            ref={statsRef}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 border border-gold/15 max-w-3xl"
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? 'none' : 'translateY(20px)',
              transition: 'opacity 0.6s ease, transform 0.6s ease',
              transitionDelay: '0.5s',
              background: 'rgba(6,23,41,0.6)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {STATS.map((s) => (
              <StatItem key={s.label.en} {...s} active={statsActive} lang={lang} />
            ))}
          </div>
        )}
      </div>

      {/* Animated gold waterline */}
      {showWave && <WaterlineWave />}

      {/* Scroll hint */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-gold/40 to-transparent" />
      </div>
    </section>
  );
}

function UnderlineAnim({ active }: { active: boolean }) {
  return (
    <span
      className="absolute bottom-0 left-0 right-0 h-px bg-gold"
      style={{
        transform: active ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left',
        transition: 'transform 0.8s ease',
        transitionDelay: '0.7s',
      }}
    />
  );
}

function WaterlineWave() {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none overflow-hidden" style={{ height: 80 }}>
      {/* Animated sine wave */}
      <div style={{ width: '200%', height: 48, animation: 'waveMove 8s linear infinite', position: 'absolute', bottom: 32, left: 0 }}>
        <svg width="100%" height="48" viewBox="0 0 1200 48" preserveAspectRatio="none">
          <path
            d="M0,24 Q75,8 150,24 Q225,40 300,24 Q375,8 450,24 Q525,40 600,24 Q675,8 750,24 Q825,40 900,24 Q975,8 1050,24 Q1125,40 1200,24"
            stroke="#C9A84C"
            strokeWidth="1"
            fill="none"
            strokeOpacity="0.5"
          />
        </svg>
      </div>
      <div style={{ width: '200%', height: 48, animation: 'waveMove 12s linear infinite reverse', position: 'absolute', bottom: 20, left: 0, opacity: 0.3 }}>
        <svg width="100%" height="48" viewBox="0 0 1200 48" preserveAspectRatio="none">
          <path
            d="M0,24 Q75,12 150,24 Q225,36 300,24 Q375,12 450,24 Q525,36 600,24 Q675,12 750,24 Q825,36 900,24 Q975,12 1050,24 Q1125,36 1200,24"
            stroke="#C9A84C"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
      {/* Bottom gradient for section transition */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-navy-deep to-transparent" />
    </div>
  );
}

function AnchorWatermark() {
  return (
    <svg viewBox="0 0 200 200" style={{ width: 300, height: 300, opacity: 0.05 }} fill="white">
      <circle cx="100" cy="40" r="20" />
      <rect x="95" y="55" width="10" height="100" />
      <path d="M60,160 Q100,180 140,160" stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" />
      <circle cx="60" cy="160" r="8" />
      <circle cx="140" cy="160" r="8" />
    </svg>
  );
}