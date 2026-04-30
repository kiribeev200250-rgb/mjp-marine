'use client';

export type Lang = 'en' | 'es' | 'ru' | 'uk';

export const LANGS: Lang[] = ['en', 'es', 'ru', 'uk'];

export function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('lang') as Lang | null;
  if (stored && LANGS.includes(stored)) return stored;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  if (nav === 'es') return 'es';
  if (nav === 'ru') return 'ru';
  if (nav === 'uk') return 'uk';
  return 'en';
}

export function setLang(lang: Lang) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  applyTranslations(lang);
}

export async function loadTranslationsFromDB(): Promise<void> {
  try {
    const res = await fetch('/api/texts');
    if (!res.ok) return;
    const items: Array<{ key: string; en: string; es: string; ru: string; uk: string }> = await res.json();
    for (const item of items) {
      const parts = item.key.split('.');
      for (const lang of LANGS) {
        let current = translations[lang] as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
          }
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = item[lang as keyof typeof item];
      }
    }
  } catch {
    // silently fall back to hardcoded translations
  }
}

export function applyTranslations(lang: Lang) {
  const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const translation = getNestedTranslation(translations[lang], key);
    if (translation) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        (el as HTMLInputElement).placeholder = translation;
      } else {
        el.textContent = translation;
      }
    }
  });
}

function getNestedTranslation(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export const translations: Record<Lang, Record<string, unknown>> = {
  en: {
    nav: { services: 'Services', how: 'How it works', contact: 'Contact', quote: 'Get a quote' },
    hero: {
      h1: 'Your boat fixed, at your marina. In 48 hours.',
      subline: 'Mobile yacht repair & maintenance service. We come to you — Alicante · Dénia · Torrevieja.',
      btn1: 'Request service',
      btn2: 'View services',
    },
    stats: { response: '48h response', fee: '€0 marina visit fee', marinas: '20+ marinas', services: '50+ service types' },
    why: {
      title: 'Why choose MJP?',
      1: { title: 'We come to your marina', desc: 'No need to move the boat. Our mobile team comes directly to your berth.' },
      2: { title: 'Quote in 2 hours', desc: 'Clear pricing, no hidden fees. You know the cost before we start.' },
      3: { title: '48h turnaround', desc: 'Fast, reliable, guaranteed. We respect your time and your schedule.' },
    },
    services: { title: 'Our Services', subtitle: 'Everything your boat needs, delivered to your marina.' },
    hiw: {
      title: 'How It Works',
      1: { title: 'Contact us', desc: 'Call, WhatsApp, or fill in the form. We respond fast.' },
      2: { title: 'Quote in 2 hours', desc: 'You receive a clear, itemised quote with no surprises.' },
      3: { title: 'We come to your marina', desc: 'Our certified technician arrives at your berth at the agreed time.' },
      4: { title: 'Job done. Back to sea.', desc: "We test everything, clean up, and you're ready to sail." },
    },
    testimonials: { title: 'What Our Clients Say' },
    contact: {
      title: 'Get a Quote',
      subtitle: 'We respond in under 2 hours. No spam.',
      name: 'Your Name',
      phone: 'Phone / WhatsApp',
      email: 'Email (optional)',
      marina: 'Select marina',
      boatType: 'Boat type',
      service: 'Service needed',
      message: 'Message',
      submit: 'Send Request',
      success: "Thanks! We'll be in touch within 2 hours.",
    },
    subscribe: {
      title: 'Stay Updated',
      desc: 'Get seasonal tips and maintenance reminders for your boat.',
      btn: 'Subscribe',
    },
    footer: {
      tagline: 'Your boat fixed, at your marina. In 48 hours.',
      copyright: '© 2026 MJP Marine Service · Costa Blanca, España',
    },
  },
  es: {
    nav: { services: 'Servicios', how: 'Cómo funciona', contact: 'Contacto', quote: 'Pedir presupuesto' },
    hero: {
      h1: 'Tu barco reparado, en tu marina. En 48 horas.',
      subline: 'Servicio móvil de reparación y mantenimiento de yates. Vamos a donde estás — Alicante · Dénia · Torrevieja.',
      btn1: 'Solicitar servicio',
      btn2: 'Ver servicios',
    },
    stats: { response: 'Respuesta en 48h', fee: '€0 tarifa de visita', marinas: '20+ marinas', services: '50+ servicios' },
    why: {
      title: '¿Por qué elegir MJP?',
      1: { title: 'Vamos a tu marina', desc: 'Sin necesidad de mover el barco. Nuestro equipo móvil viene a tu amarre.' },
      2: { title: 'Presupuesto en 2 horas', desc: 'Precios claros, sin costes ocultos. Conoces el precio antes de empezar.' },
      3: { title: 'Ejecución en 48h', desc: 'Rápido, fiable y garantizado. Respetamos tu tiempo y tu agenda.' },
    },
    services: { title: 'Nuestros Servicios', subtitle: 'Todo lo que tu barco necesita, en tu marina.' },
    hiw: {
      title: 'Cómo Funciona',
      1: { title: 'Contáctanos', desc: 'Llama, por WhatsApp o rellena el formulario. Respondemos rápido.' },
      2: { title: 'Presupuesto en 2 horas', desc: 'Recibes un presupuesto detallado y sin sorpresas.' },
      3: { title: 'Vamos a tu marina', desc: 'Nuestro técnico certificado llega a tu amarre a la hora acordada.' },
      4: { title: 'Trabajo terminado. De vuelta al mar.', desc: 'Lo probamos todo, recogemos y estás listo para navegar.' },
    },
    testimonials: { title: 'Lo Que Dicen Nuestros Clientes' },
    contact: {
      title: 'Solicitar Presupuesto',
      subtitle: 'Respondemos en menos de 2 horas. Sin spam.',
      name: 'Tu Nombre',
      phone: 'Teléfono / WhatsApp',
      email: 'Email (opcional)',
      marina: 'Selecciona marina',
      boatType: 'Tipo de barco',
      service: 'Servicio necesario',
      message: 'Mensaje',
      submit: 'Enviar Solicitud',
      success: '¡Gracias! Te contactaremos en menos de 2 horas.',
    },
    subscribe: {
      title: 'Mantente Informado',
      desc: 'Recibe consejos de temporada y recordatorios de mantenimiento.',
      btn: 'Suscribirse',
    },
    footer: {
      tagline: 'Tu barco reparado, en tu marina. En 48 horas.',
      copyright: '© 2026 MJP Marine Service · Costa Blanca, España',
    },
  },
  ru: {
    nav: { services: 'Услуги', how: 'Как это работает', contact: 'Контакты', quote: 'Получить смету' },
    hero: {
      h1: 'Ваша яхта отремонтирована прямо у вашего причала. За 48 часов.',
      subline: 'Мобильный сервис по ремонту и обслуживанию яхт. Мы приезжаем к вам — Аликанте · Дения · Торревьеха.',
      btn1: 'Заказать услугу',
      btn2: 'Посмотреть услуги',
    },
    stats: { response: 'Ответ за 48ч', fee: '€0 за выезд', marinas: '20+ марин', services: '50+ видов услуг' },
    why: {
      title: 'Почему выбирают MJP?',
      1: { title: 'Приезжаем в вашу марину', desc: 'Не нужно никуда везти лодку. Наша мобильная бригада приезжает прямо к вашей стоянке.' },
      2: { title: 'Смета за 2 часа', desc: 'Чёткое ценообразование, без скрытых платежей. Вы знаете стоимость до начала работ.' },
      3: { title: 'Выполнение за 48 часов', desc: 'Быстро, надёжно, с гарантией. Мы уважаем ваше время и расписание.' },
    },
    services: { title: 'Наши услуги', subtitle: 'Всё необходимое для вашей лодки — прямо у причала.' },
    hiw: {
      title: 'Как это работает',
      1: { title: 'Свяжитесь с нами', desc: 'Позвоните, напишите в WhatsApp или заполните форму.' },
      2: { title: 'Смета за 2 часа', desc: 'Вы получаете чёткую детализированную смету без сюрпризов.' },
      3: { title: 'Приезжаем к вам', desc: 'Наш сертифицированный специалист прибывает к вашему причалу в назначенное время.' },
      4: { title: 'Работа выполнена. Снова в море.', desc: 'Проверяем всё, убираем за собой — и вы готовы к плаванию.' },
    },
    testimonials: { title: 'Отзывы наших клиентов' },
    contact: {
      title: 'Получить смету',
      subtitle: 'Ответим менее чем за 2 часа. Без спама.',
      name: 'Ваше имя',
      phone: 'Телефон / WhatsApp',
      email: 'Email (необязательно)',
      marina: 'Выберите марину',
      boatType: 'Тип судна',
      service: 'Нужная услуга',
      message: 'Сообщение',
      submit: 'Отправить заявку',
      success: 'Спасибо! Мы свяжемся с вами в течение 2 часов.',
    },
    subscribe: {
      title: 'Будьте в курсе',
      desc: 'Получайте сезонные советы и напоминания об обслуживании вашей яхты.',
      btn: 'Подписаться',
    },
    footer: {
      tagline: 'Ваша яхта отремонтирована прямо у вашего причала. За 48 часов.',
      copyright: '© 2026 MJP Marine Service · Коста Бланка, Испания',
    },
  },
  uk: {
    nav: { services: 'Послуги', how: 'Як це працює', contact: 'Контакти', quote: 'Отримати кошторис' },
    hero: {
      h1: 'Ваш човен відремонтований у вашій марині. За 48 годин.',
      subline: 'Мобільний сервіс з ремонту та обслуговування яхт. Ми приїжджаємо до вас — Аліканте · Денія · Торревʼєха.',
      btn1: 'Замовити послугу',
      btn2: 'Переглянути послуги',
    },
    stats: { response: 'Відповідь за 48г', fee: '€0 за виїзд', marinas: '20+ марин', services: '50+ видів послуг' },
    why: {
      title: 'Чому обирають MJP?',
      1: { title: 'Приїжджаємо у вашу марину', desc: 'Не потрібно нікуди везти човен. Наша мобільна бригада приїжджає прямо до вашого місця.' },
      2: { title: 'Кошторис за 2 години', desc: 'Чітке ціноутворення, без прихованих платежів. Ви знаєте вартість до початку робіт.' },
      3: { title: 'Виконання за 48 годин', desc: 'Швидко, надійно, з гарантією. Ми поважаємо ваш час та розклад.' },
    },
    services: { title: 'Наші послуги', subtitle: 'Все необхідне для вашого човна — прямо у марині.' },
    hiw: {
      title: 'Як це працює',
      1: { title: "Зв'яжіться з нами", desc: 'Зателефонуйте, напишіть у WhatsApp або заповніть форму.' },
      2: { title: 'Кошторис за 2 години', desc: 'Ви отримуєте чіткий детальний кошторис без сюрпризів.' },
      3: { title: 'Приїжджаємо до вас', desc: 'Наш сертифікований технік прибуває до вашого місця у призначений час.' },
      4: { title: 'Роботу виконано. Знову у море.', desc: 'Перевіряємо все, прибираємо за собою — і ви готові до плавання.' },
    },
    testimonials: { title: 'Відгуки наших клієнтів' },
    contact: {
      title: 'Отримати кошторис',
      subtitle: 'Відповімо менш ніж за 2 години. Без спаму.',
      name: "Ваше ім'я",
      phone: 'Телефон / WhatsApp',
      email: "Email (необов'язково)",
      marina: 'Виберіть марину',
      boatType: 'Тип судна',
      service: 'Потрібна послуга',
      message: 'Повідомлення',
      submit: 'Надіслати запит',
      success: "Дякуємо! Ми зв'яжемося з вами протягом 2 годин.",
    },
    subscribe: {
      title: 'Будьте в курсі',
      desc: 'Отримуйте сезонні поради та нагадування про обслуговування вашого човна.',
      btn: 'Підписатися',
    },
    footer: {
      tagline: 'Ваш човен відремонтований у вашій марині. За 48 годин.',
      copyright: '© 2026 MJP Marine Service · Коста Бланка, Іспанія',
    },
  },
};
