'use client';

import { useEffect, useState, FormEvent } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';
import { trackTikTokEvent } from '@/lib/tiktok';

const labels: Record<Lang, Record<string, string>> = {
  en: { title: 'Stay Updated', desc: 'Get seasonal tips and maintenance reminders for your boat.', name: 'Your name', placeholder: 'your@email.com', btn: 'Subscribe', success: "You're subscribed! Check your inbox." },
  es: { title: 'Mantente Informado', desc: 'Recibe consejos de temporada y recordatorios de mantenimiento.', name: 'Tu nombre', placeholder: 'tu@email.com', btn: 'Suscribirse', success: '¡Suscrito! Revisa tu bandeja de entrada.' },
  ru: { title: 'Будьте в курсе', desc: 'Получайте сезонные советы и напоминания об обслуживании яхты.', name: 'Ваше имя', placeholder: 'вы@example.com', btn: 'Подписаться', success: 'Вы подписаны! Проверьте почту.' },
  uk: { title: 'Будьте в курсі', desc: 'Отримуйте сезонні поради та нагадування про обслуговування човна.', name: "Ваше ім'я", placeholder: 'ви@example.com', btn: 'Підписатися', success: 'Ви підписані! Перевірте пошту.' },
};

export default function Subscribe() {
  const [lang, setLangState] = useState<Lang>('en');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  const t = labels[lang];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, language: lang }),
      });
      if (res.ok) {
        setDone(true);
        trackTikTokEvent('Subscribe', { content_name: 'Newsletter' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        background: '#0D2D4A',
        borderTop: '1px solid rgba(201,168,76,0.15)',
        borderBottom: '1px solid rgba(201,168,76,0.15)',
        paddingTop: '3.5rem',
        paddingBottom: '3.5rem',
      }}
    >
      <div className="max-w-2xl mx-auto px-5 text-center">
        <h2
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 600,
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            color: 'white',
            marginBottom: '0.5rem',
          }}
          data-i18n="subscribe.title"
        >
          {t.title}
        </h2>
        <p
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontFamily: 'Mulish, sans-serif', fontWeight: 300, marginBottom: '2rem' }}
          data-i18n="subscribe.desc"
        >
          {t.desc}
        </p>

        {done ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              color: '#C9A84C',
              fontFamily: 'Mulish, sans-serif',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>✓</span>
            <span>{t.success}</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            className="sm:flex-row sm:gap-3"
          >
            <input
              name="name"
              required
              placeholder={t.name}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'white',
                fontFamily: 'Mulish, sans-serif',
                fontSize: '0.875rem',
                outline: 'none',
                borderRadius: 0,
              }}
              className="subscribe-input"
            />
            <input
              name="email"
              type="email"
              required
              placeholder={t.placeholder}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'white',
                fontFamily: 'Mulish, sans-serif',
                fontSize: '0.875rem',
                outline: 'none',
                borderRadius: 0,
              }}
              className="subscribe-input"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-gold"
              style={{ whiteSpace: 'nowrap', opacity: loading ? 0.6 : 1, padding: '0.75rem 1.75rem' }}
              data-i18n="subscribe.btn"
            >
              {loading ? '...' : t.btn}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .subscribe-input:focus { border-color: #C9A84C !important; }
        .subscribe-input::placeholder { color: rgba(255,255,255,0.3); }
        @media (min-width: 640px) {
          form.sm\\:flex-row { flex-direction: row; }
          form.sm\\:gap-3 { gap: 0.75rem; }
        }
      `}</style>
    </section>
  );
}