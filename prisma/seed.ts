import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const hash = await bcrypt.hash('changeme123', 12);
  await prisma.adminUser.upsert({
    where: { email: 'admin@mjpmarine.es' },
    update: {},
    create: { email: 'admin@mjpmarine.es', password: hash },
  });

  // Site config
  await prisma.siteConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      phone: '+34 600 000 000',
      whatsapp: '+34600000000',
      email: 'info@mjpmarine.es',
      hours: 'Mon–Sat 8:00–19:00',
      coverage: 'Costa Blanca — Alicante · Dénia · Torrevieja',
      instagram: 'https://instagram.com/mjpmarine',
      facebook: 'https://facebook.com/mjpmarine',
      logoUrl: null,
    },
  });

  // Services
  const services = [
    {
      icon: '✨',
      nameEn: 'Hull Polishing & Gelcoat',
      nameEs: 'Pulido de Casco & Gelcoat',
      nameRu: 'Полировка корпуса и гелькоут',
      nameUk: 'Полірування корпусу та гелькоут',
      descEn: 'Restore your hull to showroom shine. Scratch removal, oxidation treatment, full gelcoat restoration.',
      descEs: 'Restaura tu casco al brillo original. Eliminación de arañazos, tratamiento de oxidación, restauración completa de gelcoat.',
      descRu: 'Восстановите блеск корпуса. Удаление царапин, обработка окисления, полное восстановление гелькоута.',
      descUk: 'Відновіть блиск корпусу. Видалення подряпин, обробка окислення, повне відновлення гелькоуту.',
      priceLabel: 'from €180',
      sortOrder: 1,
    },
    {
      icon: '⚙️',
      nameEn: 'Engine Service',
      nameEs: 'Servicio de Motor',
      nameRu: 'Обслуживание двигателя',
      nameUk: 'Обслуговування двигуна',
      descEn: 'Full engine servicing, oil changes, impeller replacement, belt and filter checks for inboard and outboard motors.',
      descEs: 'Servicio completo de motor, cambios de aceite, sustitución de rodete, revisión de correas y filtros.',
      descRu: 'Полное техническое обслуживание двигателя, замена масла, крыльчатки, ремней и фильтров.',
      descUk: 'Повне технічне обслуговування двигуна, заміна масла, крильчатки, пасів та фільтрів.',
      priceLabel: 'from €220',
      sortOrder: 2,
    },
    {
      icon: '⚡',
      nameEn: 'Electrics & Navigation',
      nameEs: 'Eléctrica y Navegación',
      nameRu: 'Электрика и навигация',
      nameUk: 'Електрика та навігація',
      descEn: 'Wiring, battery banks, chart plotters, VHF radios, AIS installation and troubleshooting.',
      descEs: 'Cableado, bancos de baterías, plotters, radios VHF, instalación y diagnóstico de AIS.',
      descRu: 'Проводка, аккумуляторные банки, плоттеры, VHF-радио, установка и диагностика AIS.',
      descUk: 'Проводка, акумуляторні банки, плотери, VHF-радіо, встановлення та діагностика AIS.',
      priceLabel: 'from €40/h',
      sortOrder: 3,
    },
    {
      icon: '🔧',
      nameEn: 'Plumbing & Pumps',
      nameEs: 'Fontanería y Bombas',
      nameRu: 'Сантехника и помпы',
      nameUk: 'Сантехніка та помпи',
      descEn: 'Bilge pumps, water makers, through-hulls, sea cocks, hose replacement and freshwater systems.',
      descEs: 'Bombas de sentina, fabricadores de agua, pasamuros, grifos de fondo, mangueras y sistemas de agua dulce.',
      descRu: 'Трюмные помпы, водогенераторы, кингстоны, кранбуксы, шланги и системы пресной воды.',
      descUk: "Трюмні помпи, водогенератори, кінгстони, кранбукси, шланги та системи прісної води.",
      priceLabel: 'from €80',
      sortOrder: 4,
    },
    {
      icon: '🛡️',
      nameEn: 'Antifouling & Anodes',
      nameEs: 'Antifouling y Ánodos',
      nameRu: 'Необрастающее покрытие и аноды',
      nameUk: 'Протиобростаюче покриття та аноди',
      descEn: 'Bottom paint application, zinc and aluminum anode replacement, full underwater hull preparation.',
      descEs: 'Aplicación de pintura de fondo, sustitución de ánodos de zinc y aluminio, preparación completa del casco submarino.',
      descRu: 'Нанесение необрастающей краски, замена цинковых и алюминиевых анодов, полная подготовка подводной части.',
      descUk: 'Нанесення протиобростаючої фарби, заміна цинкових та алюмінієвих анодів, повна підготовка підводної частини.',
      priceLabel: 'from €350',
      sortOrder: 5,
    },
    {
      icon: '⛵',
      nameEn: 'Season Prep Package',
      nameEs: 'Paquete de Puesta a Punto',
      nameRu: 'Пакет подготовки к сезону',
      nameUk: 'Пакет підготовки до сезону',
      descEn: 'Complete pre-season service: engine check, electrical test, hull clean, safety equipment inspection, rigging check.',
      descEs: 'Servicio completo previo a la temporada: revisión de motor, prueba eléctrica, limpieza de casco, inspección de seguridad, revisión de aparejo.',
      descRu: 'Полное предсезонное обслуживание: проверка двигателя, тест электрики, чистка корпуса, осмотр оборудования безопасности, проверка такелажа.',
      descUk: 'Повне передсезонне обслуговування: перевірка двигуна, тест електрики, чищення корпусу, огляд обладнання безпеки, перевірка такелажу.',
      priceLabel: 'from €590',
      sortOrder: 6,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.sortOrder },
      update: s,
      create: { id: s.sortOrder, ...s },
    });
  }

  // Testimonials
  const testimonials = [
    {
      name: 'James H.',
      boatType: 'Jeanneau Sun Odyssey 44',
      marina: 'Marina Dénia',
      rating: 5,
      textEn: 'Outstanding service! They came to my marina within 24 hours and had the engine running perfectly. No need to move the boat — absolutely brilliant.',
      textEs: 'Servicio excepcional. Llegaron a mi marina en 24 horas y el motor funcionó perfectamente. Sin necesidad de mover el barco.',
      textRu: 'Отличный сервис! Приехали в мою марину в течение 24 часов, двигатель работает как часы. Не нужно было никуда везти лодку.',
      textUk: 'Чудовий сервіс! Приїхали в мою марину протягом 24 годин, двигун працює ідеально. Не потрібно було нікуди везти човен.',
    },
    {
      name: 'Elena M.',
      boatType: 'Bénéteau Oceanis 35',
      marina: 'Club Náutico Alicante',
      rating: 5,
      textEn: 'Fixed my electrical issue the same day. Clear pricing, professional team, and they cleaned up after themselves. 100% recommend.',
      textEs: 'Resolvieron mi problema eléctrico el mismo día. Precio claro, equipo profesional y dejaron todo limpio. Lo recomiendo 100%.',
      textRu: 'Устранили мою электрическую проблему в тот же день. Чёткое ценообразование, профессиональная команда. Рекомендую на 100%.',
      textUk: 'Усунули мою електричну проблему того ж дня. Чітке ціноутворення, професійна команда. Рекомендую на 100%.',
    },
    {
      name: 'Андрій К.',
      boatType: 'Bavaria 40 Cruiser',
      marina: 'Puerto Torrevieja',
      rating: 5,
      textEn: 'Excellent pre-season package. Everything checked, antifouling done, and boat ready for the season. Real value for money.',
      textEs: 'Excelente paquete de puesta a punto. Todo revisado, antifouling aplicado y barco listo para la temporada. Relación calidad-precio inmejorable.',
      textRu: 'Отличный предсезонный пакет. Всё проверено, необрастающее покрытие нанесено, лодка готова к сезону. Отличное соотношение цены и качества.',
      textUk: 'Чудовий передсезонний пакет. Все перевірено, протиобростаюче покриття нанесено, човен готовий до сезону. Відмінне співвідношення ціни та якості.',
    },
  ];

  for (let i = 0; i < testimonials.length; i++) {
    const t = testimonials[i];
    await prisma.testimonial.upsert({
      where: { id: i + 1 },
      update: t,
      create: { id: i + 1, ...t },
    });
  }

  // Page texts
  const pageTexts = [
    { key: 'hero.h1', en: 'Your boat fixed, at your marina. In 48 hours.', es: 'Tu barco reparado, en tu marina. En 48 horas.', ru: 'Ваша яхта отремонтирована прямо у вашего причала. За 48 часов.', uk: 'Ваш човен відремонтований у вашій марині. За 48 годин.' },
    { key: 'hero.subline', en: 'Mobile yacht repair & maintenance service. We come to you — Alicante · Dénia · Torrevieja.', es: 'Servicio móvil de reparación y mantenimiento de yates. Vamos a donde estás — Alicante · Dénia · Torrevieja.', ru: 'Мобильный сервис по ремонту и обслуживанию яхт. Мы приезжаем к вам — Аликанте · Дения · Торревьеха.', uk: 'Мобільний сервіс з ремонту та обслуговування яхт. Ми приїжджаємо до вас — Аліканте · Денія · Торревʼєха.' },
    { key: 'hero.btn1', en: 'Request service', es: 'Solicitar servicio', ru: 'Заказать услугу', uk: 'Замовити послугу' },
    { key: 'hero.btn2', en: 'View services', es: 'Ver servicios', ru: 'Посмотреть услуги', uk: 'Переглянути послуги' },
    { key: 'stats.response', en: '48h response', es: 'Respuesta en 48h', ru: 'Ответ за 48ч', uk: 'Відповідь за 48г' },
    { key: 'stats.fee', en: '€0 marina visit fee', es: '€0 tarifa de visita a marina', ru: '€0 за выезд', uk: '€0 за виїзд' },
    { key: 'stats.marinas', en: '20+ marinas', es: '20+ marinas', ru: '20+ марин', uk: '20+ марин' },
    { key: 'stats.services', en: '50+ service types', es: '50+ tipos de servicio', ru: '50+ видов услуг', uk: '50+ видів послуг' },
    { key: 'why.title', en: 'Why choose MJP?', es: '¿Por qué elegir MJP?', ru: 'Почему выбирают MJP?', uk: 'Чому обирають MJP?' },
    { key: 'why.1.title', en: 'We come to your marina', es: 'Vamos a tu marina', ru: 'Приезжаем в вашу марину', uk: 'Приїжджаємо у вашу марину' },
    { key: 'why.1.desc', en: 'No need to move the boat. Our mobile team comes directly to your berth.', es: 'Sin necesidad de mover el barco. Nuestro equipo móvil viene directamente a tu amarre.', ru: 'Не нужно никуда везти лодку. Наша мобильная бригада приезжает прямо к вашей стоянке.', uk: 'Не потрібно нікуди везти човен. Наша мобільна бригада приїжджає прямо до вашого місця.' },
    { key: 'why.2.title', en: 'Quote in 2 hours', es: 'Presupuesto en 2 horas', ru: 'Смета за 2 часа', uk: 'Кошторис за 2 години' },
    { key: 'why.2.desc', en: 'Clear pricing, no hidden fees. You know the cost before we start.', es: 'Precios claros, sin costes ocultos. Conoces el precio antes de que empecemos.', ru: 'Чёткое ценообразование, без скрытых платежей. Вы знаете стоимость до начала работ.', uk: 'Чітке ціноутворення, без прихованих платежів. Ви знаєте вартість до початку робіт.' },
    { key: 'why.3.title', en: '48h turnaround', es: 'Ejecución en 48h', ru: 'Выполнение за 48 часов', uk: 'Виконання за 48 годин' },
    { key: 'why.3.desc', en: 'Fast, reliable, guaranteed. We respect your time and your schedule.', es: 'Rápido, fiable y garantizado. Respetamos tu tiempo y tu agenda.', ru: 'Быстро, надёжно, с гарантией. Мы уважаем ваше время и расписание.', uk: 'Швидко, надійно, з гарантією. Ми поважаємо ваш час та розклад.' },
    { key: 'services.title', en: 'Our Services', es: 'Nuestros Servicios', ru: 'Наши услуги', uk: 'Наші послуги' },
    { key: 'services.subtitle', en: 'Everything your boat needs, delivered to your marina.', es: 'Todo lo que tu barco necesita, en tu marina.', ru: 'Всё необходимое для вашей лодки — прямо у причала.', uk: 'Все необхідне для вашого човна — прямо у марині.' },
    { key: 'hiw.title', en: 'How It Works', es: 'Cómo Funciona', ru: 'Как это работает', uk: 'Як це працює' },
    { key: 'hiw.1.title', en: 'Contact us', es: 'Contáctanos', ru: 'Свяжитесь с нами', uk: 'Зв\'яжіться з нами' },
    { key: 'hiw.1.desc', en: 'Call, WhatsApp, or fill in the form. We respond fast.', es: 'Llama, por WhatsApp o rellena el formulario. Respondemos rápido.', ru: 'Позвоните, напишите в WhatsApp или заполните форму.', uk: 'Зателефонуйте, напишіть у WhatsApp або заповніть форму.' },
    { key: 'hiw.2.title', en: 'Quote in 2 hours', es: 'Presupuesto en 2 horas', ru: 'Смета за 2 часа', uk: 'Кошторис за 2 години' },
    { key: 'hiw.2.desc', en: 'You receive a clear, itemised quote with no surprises.', es: 'Recibes un presupuesto detallado y sin sorpresas.', ru: 'Вы получаете чёткую детализированную смету без сюрпризов.', uk: 'Ви отримуєте чіткий детальний кошторис без сюрпризів.' },
    { key: 'hiw.3.title', en: 'We come to your marina', es: 'Vamos a tu marina', ru: 'Приезжаем к вам', uk: 'Приїжджаємо до вас' },
    { key: 'hiw.3.desc', en: 'Our certified technician arrives at your berth at the agreed time.', es: 'Nuestro técnico certificado llega a tu amarre a la hora acordada.', ru: 'Наш сертифицированный специалист прибывает к вашему причалу в назначенное время.', uk: 'Наш сертифікований технік прибуває до вашого місця у призначений час.' },
    { key: 'hiw.4.title', en: 'Job done. Back to sea.', es: 'Trabajo terminado. De vuelta al mar.', ru: 'Работа выполнена. Снова в море.', uk: 'Роботу виконано. Знову у море.' },
    { key: 'hiw.4.desc', en: 'We test everything, clean up, and you\'re ready to sail.', es: 'Lo probamos todo, recogemos y estás listo para navegar.', ru: 'Проверяем всё, убираем за собой — и вы готовы к плаванию.', uk: 'Перевіряємо все, прибираємо за собою — і ви готові до плавання.' },
    { key: 'testimonials.title', en: 'What Our Clients Say', es: 'Lo Que Dicen Nuestros Clientes', ru: 'Отзывы наших клиентов', uk: 'Відгуки наших клієнтів' },
    { key: 'contact.title', en: 'Get a Quote', es: 'Solicitar Presupuesto', ru: 'Получить смету', uk: 'Отримати кошторис' },
    { key: 'contact.subtitle', en: 'We respond in under 2 hours. No spam.', es: 'Respondemos en menos de 2 horas. Sin spam.', ru: 'Ответим менее чем за 2 часа. Без спама.', uk: 'Відповімо менш ніж за 2 години. Без спаму.' },
    { key: 'contact.name', en: 'Your Name', es: 'Tu Nombre', ru: 'Ваше имя', uk: 'Ваше ім\'я' },
    { key: 'contact.phone', en: 'Phone / WhatsApp', es: 'Teléfono / WhatsApp', ru: 'Телефон / WhatsApp', uk: 'Телефон / WhatsApp' },
    { key: 'contact.email', en: 'Email (optional)', es: 'Email (opcional)', ru: 'Email (необязательно)', uk: 'Email (необов\'язково)' },
    { key: 'contact.marina', en: 'Select marina', es: 'Selecciona marina', ru: 'Выберите марину', uk: 'Виберіть марину' },
    { key: 'contact.boatType', en: 'Boat type', es: 'Tipo de barco', ru: 'Тип судна', uk: 'Тип судна' },
    { key: 'contact.service', en: 'Service needed', es: 'Servicio necesario', ru: 'Нужная услуга', uk: 'Потрібна послуга' },
    { key: 'contact.message', en: 'Message', es: 'Mensaje', ru: 'Сообщение', uk: 'Повідомлення' },
    { key: 'contact.submit', en: 'Send Request', es: 'Enviar Solicitud', ru: 'Отправить заявку', uk: 'Надіслати запит' },
    { key: 'contact.success', en: 'Thanks! We\'ll be in touch within 2 hours.', es: '¡Gracias! Te contactaremos en menos de 2 horas.', ru: 'Спасибо! Мы свяжемся с вами в течение 2 часов.', uk: 'Дякуємо! Ми зв\'яжемося з вами протягом 2 годин.' },
    { key: 'nav.services', en: 'Services', es: 'Servicios', ru: 'Услуги', uk: 'Послуги' },
    { key: 'nav.how', en: 'How it works', es: 'Cómo funciona', ru: 'Как это работает', uk: 'Як це працює' },
    { key: 'nav.contact', en: 'Contact', es: 'Contacto', ru: 'Контакты', uk: 'Контакти' },
    { key: 'nav.quote', en: 'Get a quote', es: 'Pedir presupuesto', ru: 'Получить смету', uk: 'Отримати кошторис' },
    { key: 'footer.tagline', en: 'Your boat fixed, at your marina. In 48 hours.', es: 'Tu barco reparado, en tu marina. En 48 horas.', ru: 'Ваша яхта отремонтирована прямо у вашего причала. За 48 часов.', uk: 'Ваш човен відремонтований у вашій марині. За 48 годин.' },
    { key: 'footer.copyright', en: '© 2026 MJP Marine Service · Costa Blanca, España', es: '© 2026 MJP Marine Service · Costa Blanca, España', ru: '© 2026 MJP Marine Service · Коста Бланка, Испания', uk: '© 2026 MJP Marine Service · Коста Бланка, Іспанія' },
    { key: 'subscribe.title', en: 'Stay Updated', es: 'Mantente Informado', ru: 'Будьте в курсе', uk: 'Будьте в курсі' },
    { key: 'subscribe.desc', en: 'Get seasonal tips and maintenance reminders for your boat.', es: 'Recibe consejos de temporada y recordatorios de mantenimiento para tu barco.', ru: 'Получайте сезонные советы и напоминания об обслуживании вашей яхты.', uk: 'Отримуйте сезонні поради та нагадування про обслуговування вашого човна.' },
    { key: 'subscribe.btn', en: 'Subscribe', es: 'Suscribirse', ru: 'Подписаться', uk: 'Підписатися' },
  ];

  for (const pt of pageTexts) {
    await prisma.pageText.upsert({
      where: { key: pt.key },
      update: pt,
      create: pt,
    });
  }

  // Presite config
  await prisma.presiteConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // Presite links
  const presiteLinks = [
    { platform: 'website',   label: 'Our Website', url: 'https://mjpmarine.es',      active: true,  sortOrder: 1 },
    { platform: 'instagram', label: 'Instagram',   url: '',                           active: false, sortOrder: 2 },
    { platform: 'whatsapp',  label: 'WhatsApp',    url: 'https://wa.me/34600000000', active: true,  sortOrder: 3 },
    { platform: 'telegram',  label: 'Telegram',    url: '',                           active: false, sortOrder: 4 },
    { platform: 'tiktok',    label: 'TikTok',      url: '',                           active: false, sortOrder: 5 },
  ];
  for (const link of presiteLinks) {
    await prisma.presiteLink.upsert({
      where: { id: link.sortOrder },
      update: {},
      create: { id: link.sortOrder, ...link },
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
