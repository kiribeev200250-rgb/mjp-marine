'use client';

import { useEffect, useState, FormEvent } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

const MARINAS = [
  'Marina Dénia', 'Club Náutico Alicante', 'Puerto Torrevieja',
  'Marina Greenwich (Dénia)', 'Puerto Deportivo Jávea',
  'Club Náutico Benidorm', 'Puerto de Calpe', 'Marina Guardamar',
  'Puerto de Santa Pola', 'Club de Vela Campello',
];

const SERVICES = [
  'Hull Polishing & Gelcoat', 'Engine Service', 'Electrics & Navigation',
  'Plumbing & Pumps', 'Antifouling & Anodes', 'Season Prep Package', 'Other',
];

const labels: Record<Lang, Record<string, string>> = {
  en: { title: 'Get a Quote', subtitle: 'We respond in under 2 hours. No spam.', name: 'Your Name *', phone: 'Phone / WhatsApp *', email: 'Email (optional)', marina: 'Select marina', boatType: 'Boat type', service: 'Service needed', message: 'Message', submit: 'Send Request', success: "Thanks! We'll be in touch within 2 hours.", info: 'Contact Info', hours: 'Working Hours', coverage: 'Coverage Area' },
  es: { title: 'Solicitar Presupuesto', subtitle: 'Respondemos en menos de 2 horas. Sin spam.', name: 'Tu Nombre *', phone: 'Teléfono / WhatsApp *', email: 'Email (opcional)', marina: 'Selecciona marina', boatType: 'Tipo de barco', service: 'Servicio necesario', message: 'Mensaje', submit: 'Enviar Solicitud', success: '¡Gracias! Te contactaremos en menos de 2 horas.', info: 'Información de Contacto', hours: 'Horario', coverage: 'Zona de Cobertura' },
  ru: { title: 'Получить смету', subtitle: 'Ответим менее чем за 2 часа. Без спама.', name: 'Ваше имя *', phone: 'Телефон / WhatsApp *', email: 'Email (необязательно)', marina: 'Выберите марину', boatType: 'Тип судна', service: 'Нужная услуга', message: 'Сообщение', submit: 'Отправить заявку', success: 'Спасибо! Мы свяжемся с вами в течение 2 часов.', info: 'Контактная информация', hours: 'Рабочие часы', coverage: 'Зона обслуживания' },
  uk: { title: 'Отримати кошторис', subtitle: 'Відповімо менш ніж за 2 години. Без спаму.', name: "Ваше ім'я *", phone: 'Телефон / WhatsApp *', email: "Email (необов'язково)", marina: 'Виберіть марину', boatType: 'Тип судна', service: 'Потрібна послуга', message: 'Повідомлення', submit: 'Надіслати запит', success: "Дякуємо! Ми зв'яжемося з вами протягом 2 годин.", info: 'Контактна інформація', hours: 'Робочі години', coverage: 'Зона обслуговування' },
};

interface Config {
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  coverage: string;
}

export default function ContactSection({ config }: { config: Config }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
      form.reset();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full px-4 py-2.5 bg-beige border border-beige-dark rounded-lg text-sm text-gray-700 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors';

  return (
    <section id="contact" className="py-20 bg-beige">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3" data-i18n="contact.title">{t.title}</h2>
          <div className="w-16 h-1 bg-gradient-to-r from-gold to-orange mx-auto rounded-full mb-4" />
          <p className="text-gray-500" data-i18n="contact.subtitle">{t.subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Contact info */}
          <div className="space-y-6">
            <h3 className="font-heading text-xl font-bold text-navy">{t.info}</h3>

            <a href={`tel:${config.phone}`} className="flex items-start gap-4 group">
              <div className="w-10 h-10 bg-gold/10 border border-gold/30 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-gold transition-colors">
                📞
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Phone</p>
                <p className="font-semibold text-navy">{config.phone}</p>
              </div>
            </a>

            <a
              href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-4 group"
            >
              <div className="w-10 h-10 bg-gold/10 border border-gold/30 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-[#25D366] transition-colors">
                💬
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">WhatsApp</p>
                <p className="font-semibold text-navy">{config.phone}</p>
              </div>
            </a>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center text-white shrink-0">⏰</div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{t.hours}</p>
                <p className="font-semibold text-navy">{config.hours}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center text-white shrink-0">📍</div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{t.coverage}</p>
                <p className="font-semibold text-navy">{config.coverage}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-green-800 font-semibold text-lg">{t.success}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-cream rounded-2xl p-8 shadow-sm border border-beige-dark space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.name}</label>
                    <input name="name" required className={inputClass} placeholder={t.name} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.phone}</label>
                    <input name="phone" required className={inputClass} placeholder={t.phone} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.email}</label>
                    <input name="email" type="email" className={inputClass} placeholder={t.email} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.marina}</label>
                    <select name="marina" className={inputClass}>
                      <option value="">{t.marina}</option>
                      {MARINAS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.boatType}</label>
                    <input name="boatType" className={inputClass} placeholder={t.boatType} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.service}</label>
                    <select name="service" className={inputClass}>
                      <option value="">{t.service}</option>
                      {SERVICES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.message}</label>
                  <textarea name="message" rows={3} className={inputClass} placeholder={t.message} />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3.5 text-base disabled:opacity-60"
                >
                  {loading ? '...' : t.submit}
                </button>

                <p className="text-xs text-gray-400 text-center">🔒 {t.subtitle}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
