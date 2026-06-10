'use client';

import { useEffect, useState } from 'react';
import { trackTikTokEvent } from '@/lib/tiktok';
import { trackFBEvent } from '@/lib/facebook';

interface Link {
  id: number;
  platform: string;
  label: string;
  url: string;
  active: boolean;
}
interface Config {
  taglineEn: string; taglineEs: string; taglineRu: string; taglineUk: string;
  showWave: boolean; bgStyle: string; footerText: string;
}
interface SiteConfig { logoUrl?: string | null; companyName?: string; }

type Lang = 'en' | 'es' | 'ru' | 'uk';

const LANGS: Lang[] = ['en', 'es', 'ru', 'uk'];
const LANG_LABELS: Record<Lang, string> = { en: 'EN', es: 'ES', ru: 'RU', uk: 'UK' };

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('mjp_lang') as Lang | null;
  if (stored && (LANGS as string[]).includes(stored)) return stored;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  if (nav === 'es') return 'es';
  if (nav === 'ru') return 'ru';
  if (nav === 'uk') return 'uk';
  return 'en';
}

function getTagline(config: Config | null, lang: Lang): string {
  if (!config) return 'Mobile Yacht Repair · Costa Blanca';
  return { en: config.taglineEn, es: config.taglineEs, ru: config.taglineRu, uk: config.taglineUk }[lang];
}

async function recordClick(linkId: number) {
  const source = typeof window !== 'undefined' ? (localStorage.getItem('mjp_source') || 'direct') : 'direct';
  try {
    await fetch('/api/presite/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkId, source }),
    });
  } catch { /* fire and forget */ }
}

function firePixels(platform: string) {
  if (platform === 'whatsapp') {
    trackTikTokEvent('ClickButton', { content_name: 'Presite WhatsApp' });
    trackTikTokEvent('Contact', { content_name: 'Presite WhatsApp' });
    trackFBEvent('Contact', { content_name: 'Presite WhatsApp' });
    trackFBEvent('Lead', { content_name: 'Presite WhatsApp' });
  } else if (platform === 'phone') {
    trackTikTokEvent('ClickButton', { content_name: 'Presite Phone' });
    trackTikTokEvent('Contact', { content_name: 'Presite Phone Call' });
    trackFBEvent('Contact', { content_name: 'Presite Phone Call' });
    trackFBEvent('Lead', { content_name: 'Phone Call' });
  } else {
    const contentName = `Presite ${platform}`;
    trackTikTokEvent('ClickButton', { content_name: contentName });
    trackFBEvent('ClickButton', { content_name: contentName });
  }
}

const COPY = {
  waLabel:    { en: 'Message us on WhatsApp',          es: 'Escríbenos por WhatsApp',           ru: 'Написать в WhatsApp',            uk: 'Написати у WhatsApp' },
  waSub:      { en: 'Free quote · Usually reply in 2 hours', es: 'Presupuesto gratis · Respondemos en 2 horas', ru: 'Бесплатная оценка · Ответим за 2 часа', uk: 'Безкоштовна оцінка · Відповімо за 2 години' },
  phoneLabel: { en: 'Call us now',                     es: 'Llámanos ahora',                    ru: 'Позвонить сейчас',               uk: 'Зателефонувати зараз' },
  divider:    { en: 'Or find us on',                   es: 'O encuéntranos en',                 ru: 'Или найдите нас в',              uk: 'Або знайдіть нас у' },
  trust:      { en: 'Licensed · Insured · Costa Blanca', es: 'Licenciados · Asegurados · Costa Blanca', ru: 'Лицензия · Страховка · Коста Бланка', uk: 'Ліцензія · Страховка · Коста Бланка' },
};

export default function GoClient({ links, config, siteConfig }: {
  links: Link[];
  config: Config | null;
  siteConfig: SiteConfig | null;
}) {
  const [lang, setLangState] = useState<Lang>('en');
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    const t = setTimeout(() => setEntered(true), 80);

    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref === 'qr') {
      localStorage.setItem('mjp_source', 'qr');
      fetch('/api/presite/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: null, source: 'qr' }),
      }).catch(() => {});
    }

    return () => clearTimeout(t);
  }, []);

  const changeLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('mjp_lang', l);
  };

  const tagline = getTagline(config, lang);
  const footerText = config?.footerText ?? '© 2026 MJP Marine Service · Costa Blanca, España';

  const waLink = links.find(l => l.platform === 'whatsapp');
  const phoneLink = links.find(l => l.platform === 'phone');
  const otherLinks = links.filter(l => l.platform !== 'whatsapp' && l.platform !== 'phone');

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'linear-gradient(180deg, #0A2342 0%, #0D2D4A 55%, #061729 100%)',
      fontFamily: 'Mulish, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=Mulish:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Anchor watermark */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, pointerEvents: 'none', userSelect: 'none' }}>
        <svg viewBox="0 0 200 200" style={{ width: 300, height: 300 }} fill="white">
          <circle cx="100" cy="38" r="18" fill="none" stroke="white" strokeWidth="8" />
          <rect x="96" y="52" width="8" height="90" />
          <path d="M55,155 C55,155 75,175 100,175 C125,175 145,155 145,155" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" />
          <circle cx="55" cy="155" r="7" />
          <circle cx="145" cy="155" r="7" />
          <rect x="75" y="72" width="50" height="6" rx="3" />
        </svg>
      </div>

      {/* Animated gold wave */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ width: '200%', height: 48, animation: 'waveMove 8s linear infinite', position: 'absolute', bottom: 8 }}>
          <svg width="100%" height="48" viewBox="0 0 1200 48" preserveAspectRatio="none">
            <path d="M0,24 Q75,8 150,24 Q225,40 300,24 Q375,8 450,24 Q525,40 600,24 Q675,8 750,24 Q825,40 900,24 Q975,8 1050,24 Q1125,40 1200,24"
              stroke="#C9A84C" strokeWidth="1" fill="none" strokeOpacity="0.3" />
          </svg>
        </div>
      </div>

      {/* Language switcher — top right */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.125rem', zIndex: 10 }}>
        {LANGS.map((l, i) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => changeLang(l)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.6rem', letterSpacing: '0.08em',
                fontFamily: 'Mulish, sans-serif', fontWeight: 600,
                color: lang === l ? '#C9A84C' : 'rgba(255,255,255,0.3)',
                padding: '0.25rem 0.3rem',
                transition: 'color 0.2s ease',
              }}
            >
              {LANG_LABELS[l]}
            </button>
            {i < LANGS.length - 1 && <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.55rem' }}>·</span>}
          </span>
        ))}
      </div>

      {/* Main content */}
      <div style={{
        width: '100%', maxWidth: 420, margin: '0 auto',
        padding: '3.5rem 1.5rem 5rem',
        display: 'flex', flexDirection: 'column',
        minHeight: '100vh', position: 'relative', zIndex: 1,
      }}>

        {/* 1. Brand */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: '2rem',
          opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateY(-8px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          {siteConfig?.logoUrl ? (
            <img src={siteConfig.logoUrl} alt="MJP Marine" style={{ height: 42, width: 'auto', objectFit: 'contain', marginBottom: '0.5rem' }} />
          ) : (
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: '2.5rem', color: '#C9A84C', lineHeight: 1, letterSpacing: '-0.01em', marginBottom: '0.25rem' }}>
              MJP
            </div>
          )}
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400, fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', letterSpacing: '0.03em' }}>
            MJP Marine Service
          </p>
          <p style={{ color: 'rgba(201,168,76,0.65)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: 'Mulish, sans-serif', fontWeight: 600, textAlign: 'center' }}>
            {tagline}
          </p>
          <div style={{ width: 36, height: 1, background: 'rgba(201,168,76,0.35)', marginTop: '1.25rem' }} />
        </div>

        {/* 2. WhatsApp — dominant CTA */}
        {waLink && (
          <div style={{ marginBottom: '0.625rem', opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateY(16px)', transition: 'opacity 0.5s ease 0.08s, transform 0.5s ease 0.08s' }}>
            <WAButton link={waLink} lang={lang} />
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', fontFamily: 'Mulish, sans-serif', fontWeight: 300, marginTop: '0.5rem', letterSpacing: '0.02em' }}>
              {COPY.waSub[lang]}
            </p>
          </div>
        )}

        {/* 3. Phone — second priority */}
        {phoneLink && (
          <div style={{ marginBottom: '1.75rem', opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateY(16px)', transition: 'opacity 0.5s ease 0.16s, transform 0.5s ease 0.16s' }}>
            <PhoneBtn link={phoneLink} lang={lang} />
            <p style={{ textAlign: 'center', color: 'rgba(201,168,76,0.45)', fontSize: '0.68rem', fontFamily: 'Mulish, sans-serif', fontWeight: 400, marginTop: '0.5rem', letterSpacing: '0.06em' }}>
              {phoneLink.url.replace('tel:', '')}
            </p>
          </div>
        )}

        {/* 4. Divider */}
        {otherLinks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', opacity: entered ? 1 : 0, transition: 'opacity 0.5s ease 0.22s' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.18)' }} />
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Mulish, sans-serif', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {COPY.divider[lang]}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.18)' }} />
          </div>
        )}

        {/* 5. Other links — 2-col grid when ≥2 */}
        {otherLinks.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: otherLinks.length >= 2 ? '1fr 1fr' : '1fr',
            gap: '0.5rem',
            marginBottom: '2rem',
            opacity: entered ? 1 : 0,
            transition: 'opacity 0.5s ease 0.26s',
          }}>
            {otherLinks.map((link) => (
              <OtherBtn key={link.id} link={link} />
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* 6. Trust line */}
        <div style={{ textAlign: 'center', marginBottom: '1rem', opacity: entered ? 1 : 0, transition: 'opacity 0.5s ease 0.38s' }}>
          <p style={{ color: 'rgba(201,168,76,0.4)', fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Mulish, sans-serif', fontWeight: 500 }}>
            {COPY.trust[lang]}
          </p>
        </div>

        {/* 7. Footer */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.13)', fontSize: '0.58rem', letterSpacing: '0.05em' }}>
            {footerText}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes waveMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* ─── WhatsApp dominant button ─── */
function WAButton({ link, lang }: { link: Link; lang: Lang }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    firePixels('whatsapp');
    recordClick(link.id);
    window.open(link.url, '_blank', 'noreferrer');
  };

  return (
    <a
      href={link.url}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        padding: '20px 24px',
        background: hovered ? '#d4af52' : '#C9A84C',
        textDecoration: 'none',
        transition: 'background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 8px 28px rgba(201,168,76,0.45)' : '0 4px 16px rgba(201,168,76,0.28)',
      }}
    >
      <svg style={{ width: 22, height: 22, color: '#0A2342', flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#0A2342', letterSpacing: '0.01em' }}>
        {COPY.waLabel[lang]}
      </span>
    </a>
  );
}

/* ─── Phone button ─── */
function PhoneBtn({ link, lang }: { link: Link; lang: Lang }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    firePixels('phone');
    recordClick(link.id);
    window.location.href = link.url;
  };

  return (
    <a
      href={link.url}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        padding: '16px 24px',
        background: hovered ? 'rgba(201,168,76,0.08)' : 'rgba(10,35,66,0.6)',
        border: hovered ? '1px solid #C9A84C' : '1px solid rgba(201,168,76,0.5)',
        textDecoration: 'none',
        transition: 'all 0.18s ease',
      }}
    >
      <svg style={{ width: 18, height: 18, color: '#C9A84C', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.06 1.18 2 2 0 012 .06h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
      </svg>
      <span style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 600, fontSize: '0.95rem', color: '#C9A84C', letterSpacing: '0.02em' }}>
        {COPY.phoneLabel[lang]}
      </span>
    </a>
  );
}

/* ─── Other link button ─── */
function OtherBtn({ link }: { link: Link }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    firePixels(link.platform);
    recordClick(link.id);
    window.open(link.url, '_blank', 'noreferrer');
  };

  return (
    <a
      href={link.url}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        padding: '0.75rem 1rem',
        border: hovered ? '1px solid #C9A84C' : '1px solid rgba(201,168,76,0.2)',
        background: hovered ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)',
        textDecoration: 'none',
        transition: 'all 0.18s ease',
      }}
    >
      <span style={{ color: '#C9A84C', flexShrink: 0 }}>
        <PlatformIcon platform={link.platform} size={17} />
      </span>
      <span style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 500, fontSize: '0.85rem', color: hovered ? 'white' : 'rgba(255,255,255,0.75)', flex: 1, transition: 'color 0.18s ease' }}>
        {link.label}
      </span>
      <svg style={{ width: 13, height: 13, color: 'rgba(201,168,76,0.4)', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}

/* ─── Platform icons ─── */
function PlatformIcon({ platform, size = 20 }: { platform: string; size?: number }) {
  const s = { width: size, height: size };
  switch (platform) {
    case 'phone':
      return <svg style={s} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.06 1.18 2 2 0 012 .06h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" /></svg>;
    case 'website':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>;
    case 'instagram':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>;
    case 'whatsapp':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
    case 'telegram':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>;
    case 'tiktok':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>;
    case 'youtube':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>;
    case 'facebook':
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>;
    default:
      return <svg style={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z" /></svg>;
  }
}
