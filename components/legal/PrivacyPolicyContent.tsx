'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { detectLang, setLang, LANGS, type Lang } from '@/lib/i18n';
import { openConsentSettings } from '@/lib/consent';
import { PRIVACY_POLICY } from '@/lib/legalContent';

const COOKIE_SETTINGS_LABEL: Record<Lang, string> = {
  en: 'Cookie settings',
  es: 'Configuración de cookies',
  ru: 'Настройки cookie',
  uk: 'Налаштування cookie',
};

export default function PrivacyPolicyContent() {
  const searchParams = useSearchParams();
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    // ?lang=xx в URL выигрывает у сохранённого выбора — нужно для прямых
    // ссылок из формы Facebook Lead Ads на конкретный язык (см. футер задачи).
    const qLang = searchParams?.get('lang');
    if (qLang && (LANGS as string[]).includes(qLang)) {
      setLang(qLang as Lang);
      setLangState(qLang as Lang);
      return;
    }
    setLangState(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored && LANGS.includes(stored)) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = PRIVACY_POLICY[lang];

  return (
    <main style={{ background: '#F5F0E8', minHeight: '100vh', paddingTop: '120px', paddingBottom: '5rem' }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <h1
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 700,
            fontSize: '2.5rem',
            color: '#0A2342',
            marginBottom: '0.5rem',
          }}
        >
          {content.pageTitle}
        </h1>
        <p style={{ color: '#6B7688', fontSize: '0.85rem', marginBottom: '2rem' }}>
          {content.updatedLabel}: {content.updatedValue}
        </p>

        <p style={{ color: '#1a2a3a', fontSize: '1rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          {content.intro}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }}>
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontWeight: 700,
                  fontSize: '1.375rem',
                  color: '#0A2342',
                  marginBottom: '0.75rem',
                }}
              >
                {section.heading}
              </h2>
              {section.paragraphs?.map((p, i) => (
                <p key={i} style={{ color: '#1a2a3a', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                  {p}
                </p>
              ))}
              {section.list && (
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {section.list.map((item, i) => (
                    <li key={i} style={{ color: '#1a2a3a', fontSize: '0.95rem', lineHeight: 1.6, listStyleType: 'disc' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(10,35,66,0.12)' }}>
          <button
            onClick={() => openConsentSettings()}
            style={{
              color: '#A8893A',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {COOKIE_SETTINGS_LABEL[lang]}
          </button>
        </div>
      </div>
    </main>
  );
}
