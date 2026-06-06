'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { detectLang, setLang, loadTranslationsFromDB, LANGS, type Lang } from '@/lib/i18n';
import { trackTikTokEvent } from '@/lib/tiktok';
import { trackFBEvent } from '@/lib/facebook';

const LANG_LABELS: Record<Lang, string> = { en: 'EN', es: 'ES', ru: 'RU', uk: 'UK' };

const navLabels: Record<Lang, string[]> = {
  en: ['Services', 'How it works', 'Contact'],
  es: ['Servicios', 'Cómo funciona', 'Contacto'],
  ru: ['Услуги', 'Как это работает', 'Контакты'],
  uk: ['Послуги', 'Як це працює', 'Контакти'],
};

const quoteLabel: Record<Lang, string> = {
  en: 'Get a quote', es: 'Presupuesto', ru: 'Смету', uk: 'Кошторис',
};

const navLinks = [
  { key: 'nav.services', href: '#services' },
  { key: 'nav.how', href: '#how-it-works' },
  { key: 'nav.contact', href: '#contact' },
];

export default function Navbar({ logoUrl }: { logoUrl?: string | null }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const detected = detectLang();
    setLangState(detected);
    loadTranslationsFromDB().then(() => setLang(detected));

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored && LANGS.includes(stored)) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    return () => {
      window.removeEventListener('scroll', onScroll);
      obs.disconnect();
    };
  }, []);

  const changeLang = (l: Lang) => {
    setLangState(l);
    setLang(l);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
          scrolled
            ? 'bg-navy shadow-lg shadow-black/60 border-b border-gold/20'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-[72px]">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2 shrink-0" onClick={closeMenu}>
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="MJP Marine"
                  width={120}
                  height={40}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <span
                  style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    color: '#C9A84C',
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                  }}
                >
                  MJP
                </span>
              )}
            </a>

            {/* Center nav links */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link, i) => (
                <a
                  key={link.href}
                  href={link.href}
                  data-i18n={link.key}
                  className="label-caps text-white/70 hover:text-gold transition-colors duration-200"
                >
                  {navLabels[lang][i]}
                </a>
              ))}
            </div>

            {/* Right: lang switcher + CTA */}
            <div className="hidden md:flex items-center gap-5">
              <div className="flex items-center gap-0">
                {LANGS.map((l, i) => (
                  <span key={l} className="flex items-center">
                    <button
                      onClick={() => changeLang(l)}
                      className={`label-caps transition-colors duration-200 px-1.5 ${
                        lang === l ? 'text-gold' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {LANG_LABELS[l]}
                    </button>
                    {i < LANGS.length - 1 && (
                      <span className="text-white/20 text-xs">·</span>
                    )}
                  </span>
                ))}
              </div>
              <a
                href="#contact"
                className="btn-gold text-xs px-5 py-2.5"
                data-i18n="nav.quote"
                onClick={() => {
                  trackTikTokEvent('ClickButton', { content_name: 'Get Quote CTA Navbar' });
                  trackFBEvent('InitiateCheckout', { content_name: 'Get Quote' });
                }}
              >
                {quoteLabel[lang]}
              </a>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden text-white p-2 z-60"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Full-screen mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy flex flex-col"
          style={{ paddingTop: '72px' }}
        >
          <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="text-white/80 hover:text-gold transition-colors"
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: '2rem',
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                }}
              >
                {navLabels[lang][i]}
              </a>
            ))}

            {/* Mobile lang switcher */}
            <div className="flex items-center gap-3 mt-4">
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => changeLang(l)}
                  className={`label-caps px-3 py-1.5 border transition-all ${
                    lang === l
                      ? 'border-gold text-gold'
                      : 'border-white/20 text-white/40 hover:border-white/40 hover:text-white/70'
                  }`}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>

            <a
              href="#contact"
              className="btn-gold mt-2 w-full max-w-xs text-center"
              onClick={() => {
                closeMenu();
                trackTikTokEvent('ClickButton', { content_name: 'Get Quote CTA Navbar' });
                trackFBEvent('InitiateCheckout', { content_name: 'Get Quote' });
              }}
            >
              {quoteLabel[lang]}
            </a>
          </div>

          {/* Gold hairline at bottom of header area */}
          <div
            className="absolute top-[72px] left-0 right-0 h-px"
            style={{ background: 'rgba(201,168,76,0.3)' }}
          />
        </div>
      )}
    </>
  );
}