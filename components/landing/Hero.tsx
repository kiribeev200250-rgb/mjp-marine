'use client';

export default function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center pt-16 parallax-bg"
      style={{ backgroundImage: "url('/hero-bg.jpg')" }}
    >
      {/* Fallback gradient shown when no photo is set */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-navy-dark to-[#1a1000]" />

      {/* Dark overlay to soften the photo and ensure text readability */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Warm gradient at the bottom for section transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
          {[
            { key: 'stats.response', label: '48h response', icon: '⚡' },
            { key: 'stats.fee', label: '€0 marina visit fee', icon: '🎯' },
            { key: 'stats.marinas', label: '20+ marinas', icon: '⚓' },
            { key: 'stats.services', label: '50+ service types', icon: '🔧' },
          ].map((stat) => (
            <div key={stat.key} className="flex items-center gap-3 bg-black/40 border border-gold/20 rounded-xl px-4 py-3 backdrop-blur-sm">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-gold font-semibold text-sm leading-tight" data-i18n={stat.key}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-400 z-10">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}