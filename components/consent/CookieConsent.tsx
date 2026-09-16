'use client';

import { useEffect, useState } from 'react';
import {
  getConsent, saveConsent, type ConsentPrefs,
  CONSENT_CHANGED_EVENT, OPEN_CONSENT_SETTINGS_EVENT,
} from '@/lib/consent';
import { detectLang, type Lang, LANGS } from '@/lib/i18n';

const TEXT: Record<Lang, {
  message: string;
  privacyLink: string;
  accept: string;
  reject: string;
  customize: string;
  save: string;
  necessary: string;
  necessaryDesc: string;
  analytics: string;
  analyticsDesc: string;
  marketing: string;
  marketingDesc: string;
}> = {
  en: {
    message: 'We use cookies for site functionality, analytics and marketing (Meta, TikTok, Google). You can accept, reject, or choose which categories to allow.',
    privacyLink: 'Privacy Policy',
    accept: 'Accept all',
    reject: 'Reject non-essential',
    customize: 'Customize',
    save: 'Save preferences',
    necessary: 'Necessary',
    necessaryDesc: 'Required for the site to work. Always on.',
    analytics: 'Analytics',
    analyticsDesc: 'Google Analytics — helps us understand how the site is used.',
    marketing: 'Marketing',
    marketingDesc: 'Meta Pixel, TikTok Pixel — used for ad measurement and retargeting.',
  },
  es: {
    message: 'Usamos cookies para el funcionamiento del sitio, analítica y marketing (Meta, TikTok, Google). Puedes aceptar, rechazar o elegir qué categorías permitir.',
    privacyLink: 'Política de privacidad',
    accept: 'Aceptar todo',
    reject: 'Rechazar no esenciales',
    customize: 'Configurar',
    save: 'Guardar preferencias',
    necessary: 'Necesarias',
    necessaryDesc: 'Imprescindibles para que el sitio funcione. Siempre activas.',
    analytics: 'Analítica',
    analyticsDesc: 'Google Analytics — nos ayuda a entender el uso del sitio.',
    marketing: 'Marketing',
    marketingDesc: 'Meta Pixel, TikTok Pixel — medición de anuncios y retargeting.',
  },
  ru: {
    message: 'Мы используем cookie для работы сайта, аналитики и рекламы (Meta, TikTok, Google). Вы можете принять всё, отклонить необязательное или выбрать категории.',
    privacyLink: 'Политика конфиденциальности',
    accept: 'Принять всё',
    reject: 'Отклонить необязательное',
    customize: 'Настроить',
    save: 'Сохранить настройки',
    necessary: 'Необходимые',
    necessaryDesc: 'Нужны для работы сайта. Всегда включены.',
    analytics: 'Аналитика',
    analyticsDesc: 'Google Analytics — помогает понять, как используется сайт.',
    marketing: 'Маркетинг',
    marketingDesc: 'Meta Pixel, TikTok Pixel — для оценки эффективности рекламы.',
  },
  uk: {
    message: 'Ми використовуємо cookie для роботи сайту, аналітики та реклами (Meta, TikTok, Google). Ви можете прийняти все, відхилити необов’язкове або обрати категорії.',
    privacyLink: 'Політика конфіденційності',
    accept: 'Прийняти все',
    reject: 'Відхилити необов’язкове',
    customize: 'Налаштувати',
    save: 'Зберегти налаштування',
    necessary: 'Необхідні',
    necessaryDesc: 'Потрібні для роботи сайту. Завжди увімкнені.',
    analytics: 'Аналітика',
    analyticsDesc: 'Google Analytics — допомагає зрозуміти, як використовується сайт.',
    marketing: 'Маркетинг',
    marketingDesc: 'Meta Pixel, TikTok Pixel — для оцінки ефективності реклами.',
  },
};

export default function CookieConsent() {
  const [lang, setLangState] = useState<Lang>('en');
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPrefs>({ analytics: false, marketing: false });

  useEffect(() => {
    setLangState(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored && LANGS.includes(stored)) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    // Показать баннер только если решения ещё нет (или версия политики сменилась)
    const existing = getConsent();
    if (!existing) setVisible(true);
    else setPrefs({ analytics: existing.analytics, marketing: existing.marketing });

    const openSettings = () => {
      const current = getConsent();
      setPrefs({ analytics: !!current?.analytics, marketing: !!current?.marketing });
      setExpanded(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_CONSENT_SETTINGS_EVENT, openSettings);
    return () => {
      obs.disconnect();
      window.removeEventListener(OPEN_CONSENT_SETTINGS_EVENT, openSettings);
    };
  }, []);

  if (!visible) return null;
  const t = TEXT[lang];

  function acceptAll() {
    saveConsent({ analytics: true, marketing: true });
    setVisible(false);
  }
  function rejectAll() {
    saveConsent({ analytics: false, marketing: false });
    setVisible(false);
  }
  function savePrefs() {
    saveConsent(prefs);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={t.privacyLink}
      style={{
        position: 'fixed',
        left: '1.25rem',
        right: 'auto',
        bottom: '1.25rem',
        maxWidth: '380px',
        width: 'calc(100% - 2.5rem)',
        zIndex: 70,
        background: '#0A2342',
        border: '1px solid rgba(201,168,76,0.35)',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        padding: '1.25rem',
        fontFamily: 'Mulish, sans-serif',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
        {t.message}{' '}
        <a href="/privacy-policy" style={{ color: '#C9A84C', textDecoration: 'underline' }}>
          {t.privacyLink}
        </a>
      </p>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', opacity: 0.6 }}>
            <input type="checkbox" checked disabled style={{ marginTop: 3 }} />
            <span>
              <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{t.necessary}</span>
              <br />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>{t.necessaryDesc}</span>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={prefs.analytics}
              onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{t.analytics}</span>
              <br />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>{t.analyticsDesc}</span>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={prefs.marketing}
              onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{t.marketing}</span>
              <br />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>{t.marketingDesc}</span>
            </span>
          </label>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {expanded ? (
          <button onClick={savePrefs} className="btn-gold" style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}>
            {t.save}
          </button>
        ) : (
          <>
            <button onClick={acceptAll} className="btn-gold" style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}>
              {t.accept}
            </button>
            <button
              onClick={rejectAll}
              style={{
                fontSize: '0.78rem', padding: '0.55rem 1rem', borderRadius: '0.375rem',
                border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.75)', background: 'transparent',
              }}
            >
              {t.reject}
            </button>
            <button
              onClick={() => setExpanded(true)}
              style={{
                fontSize: '0.78rem', padding: '0.55rem 1rem', borderRadius: '0.375rem',
                border: 'none', color: '#C9A84C', background: 'transparent', textDecoration: 'underline',
              }}
            >
              {t.customize}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
