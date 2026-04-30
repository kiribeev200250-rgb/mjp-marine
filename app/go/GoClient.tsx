'use client';

import { useEffect, useState } from 'react';

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

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('lang') as Lang | null;
  if (stored) return stored;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  if (nav === 'es') return 'es';
  if (nav === 'ru') return 'ru';
  if (nav === 'uk') return 'uk';
  return 'en';
}

function getTagline(config: Config | null, lang: Lang): string {
  if (!config) return 'Mobile Yacht Repair · Costa Blanca';
  const map: Record<Lang, string> = {
    en: config.taglineEn,
    es: config.taglineEs,
    ru: config.taglineRu,
    uk: config.taglineUk,
  };
  return map[lang];
}

async function trackClick(linkId: number) {
  try {
    await fetch('/api/presite/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkId }),
    });
  } catch { /* fire and forget */ }
}

export default function GoClient({ links, config, siteConfig }: {
  links: Link[];
  config: Config | null;
  siteConfig: SiteConfig | null;
}) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    setLang(detectLang());
  }, []);

  const tagline = getTagline(config, lang);
  const showWave = config?.showWave ?? true;
  const bgStyle = config?.bgStyle ?? 'gradient';
  const footerText = config?.footerText ?? '© 2026 MJP Marine Service · Costa Blanca, España';

  const bgClass = bgStyle === 'solid'
    ? 'bg-[#0A2342]'
    : 'bg-gradient-to-b from-[#0A2342] via-[#0d2d54] to-[#071829]';

  return (
    <div className={`min-h-screen flex flex-col items-center ${bgClass}`} style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <div className="w-full max-w-sm mx-auto px-5 py-10 flex flex-col min-h-screen">

        {/* Logo area */}
        <div className="flex flex-col items-center mb-8">
          {siteConfig?.logoUrl ? (
            <img src={siteConfig.logoUrl} alt="MJP Marine" className="h-14 w-auto object-contain mb-3" />
          ) : (
            <div className="mb-3">
              <AnchorIcon className="w-14 h-14 text-[#C9A84C]" />
            </div>
          )}
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: '2.25rem', color: '#fff', lineHeight: 1, letterSpacing: '-0.01em' }}>
            {siteConfig?.companyName?.replace(' Service', '') ?? 'MJP'}
          </h1>
          <p style={{ color: 'rgba(201,168,76,0.85)', fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.35rem', fontWeight: 500 }}>
            {tagline}
          </p>
        </div>

        {/* Wave illustration */}
        {showWave && (
          <div className="w-full overflow-hidden mb-8" style={{ height: 48 }}>
            <WaveIllustration />
          </div>
        )}

        {/* Link buttons */}
        <div className="flex flex-col gap-3 flex-1">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackClick(link.id)}
              className="group flex items-center gap-4 w-full px-5 py-4 rounded-2xl border border-[#C9A84C]/30 transition-all duration-200 hover:border-[#C9A84C] hover:bg-[#C9A84C] hover:shadow-lg hover:shadow-[#C9A84C]/20"
              style={{ background: 'rgba(255,255,255,0.04)', textDecoration: 'none' }}
            >
              <span className="text-[#C9A84C] group-hover:text-[#0A2342] transition-colors duration-200 shrink-0">
                <PlatformIcon platform={link.platform} />
              </span>
              <span
                className="flex-1 font-medium text-white group-hover:text-[#0A2342] transition-colors duration-200"
                style={{ fontSize: '0.95rem' }}
              >
                {link.label}
              </span>
              <svg className="w-4 h-4 text-[#C9A84C]/50 group-hover:text-[#0A2342] group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}

          {links.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">No links configured</div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
            {footerText}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── SVG components ─── */

function AnchorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm1 5.07V10h3v2h-3v7.93A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-4.95 5.9L13 12h2.5l-2-2.5L11 12h2v5.9A6 6 0 0 1 6 12H4a8.001 8.001 0 0 0 7 7.93V12H8v-2h3V9.07a3.004 3.004 0 0 0 2 0z" />
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const cls = 'w-5 h-5';
  switch (platform) {
    case 'website':
      return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>;
    case 'instagram':
      return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>;
    case 'whatsapp':
      return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
    case 'telegram':
      return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>;
    case 'tiktok':
      return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>;
    default:
      return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8z" /></svg>;
  }
}

function WaveIllustration() {
  return (
    <div style={{ width: '200%', height: 48, animation: 'waveMove 6s linear infinite' }}>
      <style>{`
        @keyframes waveMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <svg width="100%" height="48" viewBox="0 0 800 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,24 Q50,4 100,24 Q150,44 200,24 Q250,4 300,24 Q350,44 400,24 Q450,4 500,24 Q550,44 600,24 Q650,4 700,24 Q750,44 800,24" stroke="#C9A84C" strokeWidth="1.5" fill="none" strokeOpacity="0.35" />
        <path d="M0,32 Q50,12 100,32 Q150,52 200,32 Q250,12 300,32 Q350,52 400,32 Q450,12 500,32 Q550,52 600,32 Q650,12 700,32 Q750,52 800,32" stroke="#C9A84C" strokeWidth="1" fill="none" strokeOpacity="0.2" />
      </svg>
    </div>
  );
}
