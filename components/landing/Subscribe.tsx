'use client';

import { useEffect, useState, FormEvent } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

const labels: Record<Lang, Record<string, string>> = {
  en: { title: 'Stay Updated', desc: 'Get seasonal tips and maintenance reminders for your boat.', name: 'Your name', email: 'Your email', btn: 'Subscribe', success: "You're subscribed! Check your inbox.", placeholder: 'you@example.com' },
  es: { title: 'Mantente Informado', desc: 'Recibe consejos de temporada y recordatorios de mantenimiento.', name: 'Tu nombre', email: 'Tu email', btn: 'Suscribirse', success: '¡Suscrito! Revisa tu bandeja de entrada.', placeholder: 'tu@email.com' },
  ru: { title: 'Будьте в курсе', desc: 'Получайте сезонные советы и напоминания об обслуживании вашей яхты.', name: 'Ваше имя', email: 'Ваш email', btn: 'Подписаться', success: 'Вы подписаны! Проверьте почту.', placeholder: 'вы@example.com' },
  uk: { title: 'Будьте в курсі', desc: 'Отримуйте сезонні поради та нагадування про обслуговування вашого човна.', name: "Ваше ім'я", email: 'Ваш email', btn: 'Підписатися', success: 'Ви підписані! Перевірте пошту.', placeholder: 'ви@example.com' },
};

export default function Subscribe() {
  const [lang, setLangState] = useState<Lang>('en');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem('lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
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
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-16 bg-navy">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2" data-i18n="subscribe.title">
          {t.title}
        </h2>
        <p className="text-gray-400 mb-8 text-sm" data-i18n="subscribe.desc">{t.desc}</p>

        {done ? (
          <div className="text-green-400 font-semibold">{t.success}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              name="name"
              required
              placeholder={t.name}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-gold"
            />
            <input
              name="email"
              type="email"
              required
              placeholder={t.placeholder}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-gold"
            />
            <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap disabled:opacity-60" data-i18n="subscribe.btn">
              {loading ? '...' : t.btn}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
