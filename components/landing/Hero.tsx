'use client';

import { useEffect, useRef, useState } from 'react';

interface HeroProps {
  heroBgUrl?: string | null;
  heroOverlayOpacity?: number | null;
  showHeroStats?: boolean | null;
  heroAnimation?: string | null;
  showWave?: boolean | null;
  showAnimations?: boolean | null;
}

interface StatItem {
  key: string;
  icon: string;
  prefix?: string;
  value: number;
  suffix: string;
  i18nKey: string;
}

const STATS: StatItem[] = [
  { key: 'response', icon: '⚡', value: 48,  suffix: 'h response',       i18nKey: 'stats.response' },
  { key: 'fee',      icon: '🎯', prefix: '€', value: 0, suffix: ' marina fee', i18nKey: 'stats.fee'      },
  { key: 'marinas',  icon: '⚓', value: 20,   suffix: '+ marinas',        i18nKey: 'stats.marinas'  },
  { key: 'services', icon: '🔧', value: 50,   suffix: '+ service types',  i18nKey: 'stats.services' },
];

function useCountUp(target: number, duration = 1200, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (target === 0) { setCount(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return count;
}

function StatCounter({ stat, active }: { stat: StatItem; active: boolean }) {
  const count = useCountUp(stat.value, 1400, active);
  return (
    <div className="flex items-center gap-3 bg-black/40 border border-gold/20 rounded-xl px-4 py-3 backdrop-blur-sm">
      <span className="text-2xl">{stat.icon}</span>
      <span className="text-gold font-semibold text-sm leading-tight" data-i18n={stat.i18nKey}>
        {stat.prefix ?? ''}{count}{stat.suffix}
      </span>
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
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    if (!showAnimations || !showHeroStats) return;
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [showAnimations, showHeroStats]);

  const animClass =
    heroAnimation === 'fade'
      ? 'animate-fade-in'
      : heroAnimation === 'slide'
        ? 'animate-slide-up'
        : '';

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-16 parallax-bg">
      {/* Background image or fallback gradient */}
      {heroBgUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${heroBgUrl}')` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-black via-navy-dark to-[#1a1000]" />
      )}

      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(10,35,66,${overlayOpacity})` }}
      />

      {/* Bottom gradient for section transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />

      <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 ${animClass}`}>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-gold text-xs font-semibold tracking-wide uppercase">Mobile Yacht Service · Costa Blanca</span>
          </div>

          <h1
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-100 leading-tight mb-6"
            data-i18n="hero.h1"
          >
            Your boat fixed, at your marina.{' '}
            <span className="text-gold">In 48 hours.</span>
          </h1>

          <p
            className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl leading-relaxed font-light"
            data-i18n="hero.subline"
          >
            Mobile yacht repair & maintenance service. We come to you — Alicante · Dénia · Torrevieja.
          </p>

          <div className="flex flex-wrap gap-4 mb-16">
            <a href="#contact" className="btn-primary px-8 py-3.5 text-base" data-i18n="hero.btn1">
              Request service
            </a>
            <a href="#services" className="btn-outline px-8 py-3.5 text-base" data-i18n="hero.btn2">
              View services
            </a>
          </div>
        </div>

        {/* Stats strip */}
        {showHeroStats && (
          <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {STATS.map((stat) => (
              showAnimations
                ? <StatCounter key={stat.key} stat={stat} active={statsVisible} />
                : (
                  <div key={stat.key} className="flex items-center gap-3 bg-black/40 border border-gold/20 rounded-xl px-4 py-3 backdrop-blur-sm">
                    <span className="text-2xl">{stat.icon}</span>
                    <span className="text-gold font-semibold text-sm leading-tight" data-i18n={stat.i18nKey}>
                      {stat.prefix ?? ''}{stat.value}{stat.suffix}
                    </span>
                  </div>
                )
            ))}
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-400 z-10">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Animated SVG wave */}
      {showWave && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none overflow-hidden leading-none">
          <svg
            viewBox="0 0 1200 80"
            preserveAspectRatio="none"
            className="w-full h-16 md:h-20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="wave-path"
              d="M0,30 C180,55 420,5 600,30 C780,55 980,5 1200,30 L1200,80 L0,80 Z"
              fill="rgba(10,35,66,0.6)"
            />
            <path
              d="M0,45 C240,20 480,65 600,45 C720,25 960,65 1200,45 L1200,80 L0,80 Z"
              fill="rgba(10,35,66,0.85)"
              style={{ animation: 'wave-drift 10s ease-in-out infinite alternate-reverse' }}
            />
          </svg>
        </div>
      )}
    </section>
  );
}
