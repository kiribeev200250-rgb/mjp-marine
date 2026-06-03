'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
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
  en: {
    title: 'Get a Quote', subtitle: 'We respond in under 2 hours. No spam.',
    name: 'Your Name', phone: 'Phone / WhatsApp', email: 'Email (optional)',
    marina: 'Select marina', boatType: 'Boat type', service: 'Service needed',
    message: 'Message', submit: 'Send Request', success: "Thanks! We'll be in touch within 2 hours.",
    infoTitle: 'Contact Info', hoursLabel: 'Working Hours', coverageLabel: 'Coverage Area',
    phoneLabel: 'Phone', waLabel: 'WhatsApp', emailLabel: 'Email',
  },
  es: {
    title: 'Solicitar Presupuesto', subtitle: 'Respondemos en menos de 2 horas. Sin spam.',
    name: 'Tu Nombre', phone: 'Teléfono / WhatsApp', email: 'Email (opcional)',
    marina: 'Selecciona marina', boatType: 'Tipo de barco', service: 'Servicio necesario',
    message: 'Mensaje', submit: 'Enviar Solicitud', success: '¡Gracias! Te contactaremos en menos de 2 horas.',
    infoTitle: 'Información de Contacto', hoursLabel: 'Horario', coverageLabel: 'Zona de Cobertura',
    phoneLabel: 'Teléfono', waLabel: 'WhatsApp', emailLabel: 'Email',
  },
  ru: {
    title: 'Получить смету', subtitle: 'Ответим менее чем за 2 часа. Без спама.',
    name: 'Ваше имя', phone: 'Телефон / WhatsApp', email: 'Email (необязательно)',
    marina: 'Выберите марину', boatType: 'Тип судна', service: 'Нужная услуга',
    message: 'Сообщение', submit: 'Отправить заявку', success: 'Спасибо! Мы свяжемся с вами в течение 2 часов.',
    infoTitle: 'Контактная информация', hoursLabel: 'Рабочие часы', coverageLabel: 'Зона обслуживания',
    phoneLabel: 'Телефон', waLabel: 'WhatsApp', emailLabel: 'Email',
  },
  uk: {
    title: 'Отримати кошторис', subtitle: 'Відповімо менш ніж за 2 години. Без спаму.',
    name: "Ваше ім'я", phone: 'Телефон / WhatsApp', email: "Email (необов'язково)",
    marina: 'Виберіть марину', boatType: 'Тип судна', service: 'Потрібна послуга',
    message: 'Повідомлення', submit: 'Надіслати запит', success: "Дякуємо! Ми зв'яжемося з вами протягом 2 годин.",
    infoTitle: 'Контактна інформація', hoursLabel: 'Робочі години', coverageLabel: 'Зона обслуговування',
    phoneLabel: 'Телефон', waLabel: 'WhatsApp', emailLabel: 'Email',
  },
};

interface Config {
  phone: string; whatsapp: string; email: string;
  hours: string; coverage: string; whatsappUrl?: string;
}

interface ContactSectionProps {
  config: Config;
  showAnimations?: boolean | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 0.875rem',
  background: 'rgba(255,255,255,0.05)',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.15)',
  color: 'white',
  fontFamily: 'Mulish, sans-serif',
  fontWeight: 400,
  fontSize: '0.9rem',
  outline: 'none',
  borderRadius: 0,
  transition: 'border-bottom-color 0.2s ease',
};

export default function ContactSection({ config, showAnimations }: ContactSectionProps) {
  const [lang, setLangState] = useState<Lang>('en');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const animate = showAnimations !== false;
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLangState(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!animate) { setVisible(true); return; }
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate]);

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
      if (typeof window !== 'undefined' && window.ttq) {
        window.ttq.track('SubmitForm');
        window.ttq.track('Contact');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const waHref = config.whatsappUrl || (config.whatsapp ? `https://wa.me/${config.whatsapp.replace(/\D/g, '')}` : null);

  const contactCards = [
    { condition: !!config.phone, icon: '📞', label: t.phoneLabel, value: config.phone, href: `tel:${config.phone}`, highlight: false },
    { condition: !!config.whatsapp, icon: '💬', label: t.waLabel, value: config.whatsapp, href: waHref, highlight: true },
    { condition: !!config.email, icon: '✉️', label: t.emailLabel, value: config.email, href: `mailto:${config.email}`, highlight: false },
    { condition: !!config.hours, icon: '⏰', label: t.hoursLabel, value: config.hours, href: null, highlight: false },
    { condition: !!config.coverage, icon: '📍', label: t.coverageLabel, value: config.coverage, href: null, highlight: false },
  ].filter(c => c.condition);

  return (
    <section
      id="contact"
      style={{ background: '#0A2342', paddingTop: '5rem', paddingBottom: '5rem' }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div
          ref={sectionRef}
          className={`text-center mb-14 ${animate ? 'reveal' : ''} ${animate && visible ? 'visible' : ''}`}
        >
          <p className="label-caps mb-3" style={{ color: 'rgba(201,168,76,0.7)' }}>Get in touch</p>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontWeight: 600,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: 'white',
              lineHeight: 1.1,
              marginBottom: '1rem',
            }}
            data-i18n="contact.title"
          >
            {t.title}
          </h2>
          <div style={{ width: 48, height: 1, background: '#C9A84C', margin: '0 auto 1rem' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Mulish, sans-serif', fontWeight: 300 }} data-i18n="contact.subtitle">
            {t.subtitle}
          </p>
        </div>

        {/* Split layout */}
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-16">
          {/* Left: contact info */}
          <div className="lg:col-span-2 space-y-4">
            <h3
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontWeight: 600,
                fontSize: '1.5rem',
                color: 'white',
                marginBottom: '1.5rem',
              }}
              data-i18n="contact.infoTitle"
            >
              {t.infoTitle}
            </h3>

            {contactCards.map((card, i) => {
              const inner = (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '1.25rem',
                    background: card.highlight ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.04)',
                    border: card.highlight ? '1px solid rgba(201,168,76,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 0,
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  {/* Icon in gold circle */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'rgba(201,168,76,0.15)',
                      border: '1px solid rgba(201,168,76,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    {card.icon}
                  </div>
                  <div>
                    <p className="label-caps" style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '0.3rem' }}>
                      {card.label}
                    </p>
                    <p
                      style={{
                        fontFamily: 'Cormorant Garamond, serif',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        color: card.highlight ? '#C9A84C' : 'white',
                        lineHeight: 1.3,
                      }}
                    >
                      {card.value}
                    </p>
                  </div>
                </div>
              );

              return card.href ? (
                <a key={i} href={card.href} target={card.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                  {inner}
                </a>
              ) : inner;
            })}
          </div>

          {/* Right: form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div
                style={{
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  padding: '3rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, fontSize: '1.5rem', color: 'white' }}>
                  {t.success}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.name">{t.name}</label>
                    <input name="name" required style={inputStyle} placeholder={t.name} className="contact-input" />
                  </div>
                  <div>
                    <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.phone">{t.phone}</label>
                    <input name="phone" required style={inputStyle} placeholder={t.phone} className="contact-input" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.email">{t.email}</label>
                    <input name="email" type="email" style={inputStyle} placeholder={t.email} className="contact-input" />
                  </div>
                  <div>
                    <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.marina">{t.marina}</label>
                    <select name="marina" style={{ ...inputStyle, cursor: 'pointer' }} className="contact-input">
                      <option value="">{t.marina}</option>
                      {MARINAS.map((m) => <option key={m} style={{ background: '#0A2342' }}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.boatType">{t.boatType}</label>
                    <input name="boatType" style={inputStyle} placeholder={t.boatType} className="contact-input" />
                  </div>
                  <div>
                    <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.service">{t.service}</label>
                    <select name="service" style={{ ...inputStyle, cursor: 'pointer' }} className="contact-input">
                      <option value="">{t.service}</option>
                      {SERVICES.map((s) => <option key={s} style={{ background: '#0A2342' }}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-caps" style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }} data-i18n="contact.message">{t.message}</label>
                  <textarea name="message" rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder={t.message} className="contact-input" />
                </div>

                {error && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full"
                  style={{ padding: '1rem', fontSize: '0.85rem', opacity: loading ? 0.6 : 1 }}
                  data-i18n="contact.submit"
                >
                  {loading ? '...' : t.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .contact-input:focus {
          border-bottom-color: #C9A84C !important;
          outline: none;
        }
        .contact-input option {
          background: #0A2342;
          color: white;
        }
      `}</style>
    </section>
  );
}