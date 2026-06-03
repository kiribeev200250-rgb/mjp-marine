'use client';

import { useEffect, useRef, useState } from 'react';
import { detectLang, type Lang } from '@/lib/i18n';

const steps = [
  {
    num: '01',
    titleKey: 'hiw.1.title',
    descKey: 'hiw.1.desc',
    titles: { en: 'Contact us', es: 'Contáctanos', ru: 'Свяжитесь с нами', uk: "Зв'яжіться з нами" },
    descs: { en: 'Call, WhatsApp, or fill in the form. We respond fast.', es: 'Llama, por WhatsApp o rellena el formulario. Respondemos rápido.', ru: 'Позвоните, напишите в WhatsApp или заполните форму.', uk: 'Зателефонуйте, напишіть у WhatsApp або заповніть форму.' },
  },
  {
    num: '02',
    titleKey: 'hiw.2.title',
    descKey: 'hiw.2.desc',
    titles: { en: 'Quote in 2 hours', es: 'Presupuesto en 2 horas', ru: 'Смета за 2 часа', uk: 'Кошторис за 2 години' },
    descs: { en: 'You receive a clear, itemised quote with no surprises.', es: 'Recibes un presupuesto detallado y sin sorpresas.', ru: 'Вы получаете чёткую детализированную смету без сюрпризов.', uk: 'Ви отримуєте чіткий детальний кошторис без сюрпризів.' },
  },
  {
    num: '03',
    titleKey: 'hiw.3.title',
    descKey: 'hiw.3.desc',
    titles: { en: 'We come to your marina', es: 'Vamos a tu marina', ru: 'Приезжаем к вам', uk: 'Приїжджаємо до вас' },
    descs: { en: 'Our certified technician arrives at your berth at the agreed time.', es: 'Nuestro técnico certificado llega a tu amarre a la hora acordada.', ru: 'Наш сертифицированный специалист прибывает в назначенное время.', uk: 'Наш сертифікований технік прибуває у призначений час.' },
  },
  {
    num: '04',
    titleKey: 'hiw.4.title',
    descKey: 'hiw.4.desc',
    titles: { en: 'Job done. Back to sea.', es: 'Trabajo terminado. De vuelta al mar.', ru: 'Работа выполнена. Снова в море.', uk: 'Роботу виконано. Знову у море.' },
    descs: { en: "We test everything, clean up, and you're ready to sail.", es: 'Lo probamos todo, recogemos y estás listo para navegar.', ru: 'Проверяем всё, убираем за собой — вы готовы к плаванию.', uk: 'Перевіряємо все, прибираємо за собою — ви готові до плавання.' },
  },
];

const sectionTitles: Record<Lang, string> = {
  en: 'How It Works', es: 'Cómo Funciona', ru: 'Как это работает', uk: 'Як це працює',
};

interface HowItWorksProps {
  showAnimations?: boolean | null;
}

export default function HowItWorks({ showAnimations }: HowItWorksProps) {
  const animate = showAnimations !== false;
  const [lang, setLang] = useState<Lang>('en');
  const titleRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const [titleVisible, setTitleVisible] = useState(false);
  const [stepsVisible, setStepsVisible] = useState(false);
  const [lineVisible, setLineVisible] = useState(false);

  useEffect(() => {
    setLang(detectLang());
    const obs = new MutationObserver(() => {
      const stored = localStorage.getItem('mjp_lang') as Lang | null;
      if (stored) setLang(stored);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!animate) { setTitleVisible(true); setStepsVisible(true); setLineVisible(true); return; }
    const observe = (el: HTMLElement | null, setter: (v: boolean) => void) => {
      if (!el) return;
      const io = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) { setter(true); io.disconnect(); } },
        { threshold: 0.12 }
      );
      io.observe(el);
      return () => io.disconnect();
    };
    const d1 = observe(titleRef.current, setTitleVisible);
    const d2 = observe(stepsRef.current, (v) => { setStepsVisible(v); setLineVisible(v); });
    return () => { d1?.(); d2?.(); };
  }, [animate]);

  return (
    <section id="how-it-works" style={{ background: '#0A2342', paddingTop: '5rem', paddingBottom: '5rem' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div
          ref={titleRef}
          className={`text-center mb-16 ${animate ? 'reveal' : ''} ${animate && titleVisible ? 'visible' : ''}`}
        >
          <p className="label-caps mb-3" style={{ color: 'rgba(201,168,76,0.7)' }}>The process</p>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontWeight: 600,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#FFFFFF',
              lineHeight: 1.1,
              marginBottom: '1rem',
            }}
            data-i18n="hiw.title"
          >
            {sectionTitles[lang]}
          </h2>
          <div style={{ width: 48, height: 1, background: '#C9A84C', margin: '0 auto' }} />
        </div>

        {/* Steps */}
        <div ref={stepsRef} className="relative">
          {/* Animated connecting line (desktop) */}
          <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px overflow-hidden" style={{ zIndex: 0 }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(to right, transparent, #C9A84C, transparent)',
                transformOrigin: 'left',
                transform: lineVisible ? 'scaleX(1)' : 'scaleX(0)',
                transition: lineVisible ? 'transform 1.2s ease 0.3s' : 'none',
                opacity: 0.5,
              }}
            />
          </div>

          <div
            className={`grid md:grid-cols-4 gap-8 md:gap-6 relative z-10 ${animate ? 'reveal-stagger' : ''} ${animate && stepsVisible ? 'visible' : ''}`}
          >
            {steps.map((step, i) => (
              <div key={step.num} className="flex flex-col items-center text-center relative">
                {/* Step number circle */}
                <div
                  className="w-16 h-16 flex items-center justify-center mb-6 shrink-0"
                  style={{
                    background: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.4)',
                    borderRadius: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Space Mono, monospace',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      color: '#C9A84C',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {step.num}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontWeight: 600,
                    fontSize: '1.3rem',
                    color: '#FFFFFF',
                    marginBottom: '0.75rem',
                    lineHeight: 1.2,
                  }}
                  data-i18n={step.titleKey}
                >
                  {step.titles[lang]}
                </h3>
                <p
                  style={{
                    fontFamily: 'Mulish, sans-serif',
                    fontWeight: 300,
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.55)',
                    lineHeight: 1.65,
                  }}
                  data-i18n={step.descKey}
                >
                  {step.descs[lang]}
                </p>

                {/* Mobile connector */}
                {i < steps.length - 1 && (
                  <div
                    className="md:hidden mt-6"
                    style={{ width: 1, height: 32, background: 'rgba(201,168,76,0.3)', margin: '1.5rem auto 0' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}