'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { detectLang, setLang, loadTranslationsFromDB, LANGS, type Lang } from '@/lib/i18n';

const LANG_LABELS: Record<Lang, string> = { en: 'EN', es: 'ES', ru: 'RU', uk: 'UK' };

export default function Navbar({ logoUrl }: { logoUrl?: string | null }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const detected = detectLang();
    setLangState(detected);
    loadTranslationsFromDB().then(() => setLang(detected));

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const changeLang = (l: Lang) => {
    setLangState(l);
    setLang(l);
  };

  const navLinks = [
    { key: 'nav.services', href: '#services' },
    { key: 'nav.how', href: '#how-it-works' },
    { key: 'nav.contact', href: '#contact' },
  ];

  const navLabels: Record<Lang, string[]> = {
    en: ['Services', 'How it works', 'Contact'],
    es: ['Servicios', 'Cómo funciona', 'Contacto'],
    ru: ['Услуги', 'Как это работает', 'Контакты'],
    uk: ['Послуги', 'Як це працює', 'Контакти'],
  };

  const quoteLabel: Record<Lang, string> = {
    en: 'Get a quote', es: 'Pedir presupuesto', ru: 'Получить смету', uk: 'Отримати кошторис',
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-navy-dark shadow-lg shadow-black/50' : 'bg-navy-dark/90 backdrop-blur-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 shrink-0">
            {logoUrl ? (
              <Image src={logoUrl} alt="MJP Marine" width={120} height={40} className="h-10 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-gold text-2xl">⚓</span>
                <span className="text-white font-heading text-xl font-bold tracking-wide">MJP</span>
                <span className="text-gold/80 text-xs font-sans hidden sm:block tracking-widest uppercase">Marine</span>
              </div>
            )}
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-400 hover:text-gold transition-colors text-sm font-medium"
                data-i18n={link.key}
              >
                {navLabels[lang][i]}
              </a>
            ))}
          </div>

          {/* Right: lang switcher + CTA */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex gap-1 bg-black/50 border border-white/10 rounded-full p-1">
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => changeLang(l)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${lang === l ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
            <a href="#contact" className="btn-primary text-xs px-4 py-2" data-i18n="nav.quote">
              {quoteLabel[lang]}
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-white/10 pt-3">
            <div className="flex flex-col gap-3">
              {navLinks.map((link, i) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-gray-300 hover:text-gold text-sm py-1"
                  onClick={() => setMenuOpen(false)}
                >
                  {navLabels[lang][i]}
                </a>
              ))}
              <div className="flex gap-1 mt-2">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => changeLang(l)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === l ? 'bg-gold text-black' : 'text-gray-400 border border-gray-600'}`}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
              <a href="#contact" className="btn-primary text-center mt-2" onClick={() => setMenuOpen(false)}>
                {quoteLabel[lang]}
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
