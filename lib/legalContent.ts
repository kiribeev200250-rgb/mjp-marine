import type { Lang } from './i18n';

// Текст политики конфиденциальности по языкам. Это ШАБЛОН, структурно
// покрывающий обязательные разделы GDPR + испанского LOPDGDD — перед боевым
// использованием должен быть проверен юристом/gestor (см. финальное
// сообщение чата, где это было явно оговорено). Реквизиты ответственного за
// обработку — заглушки [PLACEHOLDER], владелец должен их вписать.

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface PolicyContent {
  pageTitle: string;
  intro: string;
  updatedLabel: string;
  updatedValue: string;
  sections: PolicySection[];
}

export const PRIVACY_POLICY: Record<Lang, PolicyContent> = {
  es: {
    pageTitle: 'Política de privacidad',
    intro:
      'Esta Política de Privacidad describe cómo MJP Marine Service recoge, utiliza y protege los datos personales de quienes visitan mjpmarine.com o envían sus datos a través de nuestros formularios, incluidos los formularios de clientes potenciales ("Lead Ads") en Meta (Facebook/Instagram).',
    updatedLabel: 'Última actualización',
    updatedValue: '16 de septiembre de 2026',
    sections: [
      {
        heading: '1. Responsable del tratamiento',
        paragraphs: ['El responsable del tratamiento de los datos recogidos a través de este sitio web es:'],
        list: [
          'Titular / razón social: [NOMBRE O RAZÓN SOCIAL]',
          'NIF: [NIF]',
          'Dirección: [DIRECCIÓN]',
          'Email de contacto: [EMAIL]',
        ],
      },
      {
        heading: '2. Qué datos recogemos',
        paragraphs: [
          'A través de los formularios del sitio y de los formularios de clientes potenciales en Meta (Facebook/Instagram) podemos recoger:',
        ],
        list: [
          'Nombre y apellidos',
          'Teléfono',
          'Email',
          'Marina donde está atracada la embarcación',
          'Tipo de embarcación y tipo de reparación o servicio solicitado',
          'Mensaje o comentarios adicionales que nos envíes',
          'Si te suscribes a nuestro boletín: nombre, email e idioma preferido',
        ],
      },
      {
        heading: '3. Finalidades del tratamiento',
        list: [
          'Gestionar tu solicitud de presupuesto o reparación y contactar contigo',
          'Prestar el servicio contratado y facturar cuando corresponda',
          'Enviarte el boletín informativo si te has suscrito voluntariamente',
          'Medir la eficacia de nuestras campañas publicitarias (Meta, TikTok, Google) si has dado tu consentimiento a las cookies correspondientes',
        ],
      },
      {
        heading: '4. Base jurídica',
        paragraphs: ['El tratamiento de tus datos se basa en:'],
        list: [
          'Tu consentimiento (art. 6.1.a RGPD), al enviar un formulario, suscribirte al boletín o aceptar cookies de analítica/marketing',
          'La ejecución de un contrato o medidas precontractuales (art. 6.1.b RGPD), cuando solicitas un presupuesto o contratas un servicio',
          'El interés legítimo (art. 6.1.f RGPD) para responder a tu solicitud inicial de contacto',
        ],
      },
      {
        heading: '5. Dónde se almacenan los datos',
        paragraphs: [
          'Los datos se almacenan en bases de datos gestionadas por Supabase Inc., sobre infraestructura de Amazon Web Services (región: eu-west-2, Londres, Reino Unido — país con decisión de adecuación de la Comisión Europea para transferencias internacionales). El sitio web está alojado en Vercel Inc. Ambos proveedores actúan como encargados del tratamiento.',
        ],
      },
      {
        heading: '6. Terceros con los que compartimos datos',
        paragraphs: [
          'Utilizamos los siguientes proveedores, que pueden acceder a tus datos como encargados del tratamiento o, en el caso de las plataformas publicitarias, como responsables independientes de los datos que procesan en sus propias plataformas:',
        ],
        list: [
          'Meta (Facebook/Instagram) — píxel de seguimiento y formularios de clientes potenciales (Lead Ads); solo si aceptas cookies de marketing',
          'TikTok — píxel de seguimiento publicitario; solo si aceptas cookies de marketing',
          'Google (Google Analytics) — analítica de uso del sitio; solo si aceptas cookies de analítica',
          'Resend — envío de emails transaccionales (confirmación de solicitud, boletín)',
          'Supabase — almacenamiento de la base de datos',
          'Vercel — alojamiento del sitio web',
        ],
      },
      {
        heading: '7. Plazo de conservación',
        list: [
          'Solicitudes de contacto o presupuesto: mientras exista relación comercial y hasta 1 año tras el último contacto, salvo obligación legal superior',
          'Documentos fiscales (facturas): 6 años, conforme al Código de Comercio español',
          'Suscripción al boletín: hasta que retires tu consentimiento (baja disponible en cualquier momento)',
          'Cookies de analítica/marketing: según la política de retención de cada proveedor (Meta, TikTok, Google), habitualmente entre 90 días y 2 años',
        ],
      },
      {
        heading: '8. Tus derechos',
        paragraphs: [
          'Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, limitación del tratamiento, portabilidad y oposición, así como retirar tu consentimiento sin que ello afecte a la licitud del tratamiento previo. Para ejercerlos, escríbenos a [EMAIL] indicando el derecho que deseas ejercer.',
        ],
      },
      {
        heading: '9. Derecho a reclamar ante la AEPD',
        paragraphs: [
          'Si consideras que el tratamiento de tus datos no se ajusta a la normativa, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) — www.aepd.es.',
        ],
      },
      {
        heading: '10. Cookies y píxeles',
        paragraphs: [
          'Este sitio utiliza cookies propias necesarias para su funcionamiento y, solo con tu consentimiento previo, cookies de analítica y marketing:',
        ],
        list: [
          'Necesarias — guardan tu elección de idioma y de cookies. No requieren consentimiento.',
          'Analítica — Google Analytics, para entender cómo se usa el sitio. Solo se cargan si aceptas.',
          'Marketing — Meta Pixel y TikTok Pixel, para medir campañas publicitarias. Solo se cargan si aceptas.',
        ],
      },
    ],
  },

  en: {
    pageTitle: 'Privacy Policy',
    intro:
      'This Privacy Policy describes how MJP Marine Service collects, uses and protects the personal data of people who visit mjpmarine.com or submit their data through our forms, including Lead Ads forms on Meta (Facebook/Instagram).',
    updatedLabel: 'Last updated',
    updatedValue: 'September 16, 2026',
    sections: [
      {
        heading: '1. Data controller',
        paragraphs: ['The controller responsible for data collected through this website is:'],
        list: [
          'Company / owner name: [COMPANY NAME]',
          'NIF (Spanish tax ID): [NIF]',
          'Address: [ADDRESS]',
          'Contact email: [EMAIL]',
        ],
      },
      {
        heading: '2. What data we collect',
        paragraphs: ['Through the forms on our site and Meta (Facebook/Instagram) Lead Ads forms, we may collect:'],
        list: [
          'First and last name',
          'Phone number',
          'Email address',
          'The marina where the boat is berthed',
          'Boat type and the type of repair or service requested',
          'Any message or additional comments you send us',
          'If you subscribe to our newsletter: name, email and preferred language',
        ],
      },
      {
        heading: '3. Purposes of processing',
        list: [
          'To handle your quote or repair request and get in touch with you',
          'To provide the contracted service and issue invoices where applicable',
          'To send our newsletter if you subscribed voluntarily',
          'To measure the performance of our advertising campaigns (Meta, TikTok, Google) if you consented to the relevant cookies',
        ],
      },
      {
        heading: '4. Legal basis',
        paragraphs: ['Processing of your data is based on:'],
        list: [
          'Your consent (GDPR art. 6.1.a), when you submit a form, subscribe to the newsletter, or accept analytics/marketing cookies',
          'Performance of a contract or pre-contractual steps (GDPR art. 6.1.b), when you request a quote or contract a service',
          'Legitimate interest (GDPR art. 6.1.f), to respond to your initial contact request',
        ],
      },
      {
        heading: '5. Where data is stored',
        paragraphs: [
          'Data is stored in databases managed by Supabase Inc., on Amazon Web Services infrastructure (data region: eu-west-2, London, UK — a country with an EU adequacy decision for international transfers). The website itself is hosted by Vercel Inc. Both providers act as data processors.',
        ],
      },
      {
        heading: '6. Third parties we share data with',
        paragraphs: [
          'We use the following providers, who may access your data as data processors or, in the case of ad platforms, as independent controllers of the data they process on their own platforms:',
        ],
        list: [
          'Meta (Facebook/Instagram) — tracking pixel and Lead Ads forms; only if you consent to marketing cookies',
          'TikTok — advertising tracking pixel; only if you consent to marketing cookies',
          'Google (Google Analytics) — site usage analytics; only if you consent to analytics cookies',
          'Resend — transactional emails (request confirmation, newsletter)',
          'Supabase — database storage',
          'Vercel — website hosting',
        ],
      },
      {
        heading: '7. Retention period',
        list: [
          'Contact/quote requests: for as long as a business relationship exists and up to 1 year after the last contact, unless a longer legal retention obligation applies',
          'Fiscal documents (invoices): 6 years, per Spanish Commercial Code (Código de Comercio)',
          'Newsletter subscription: until you withdraw consent (you can unsubscribe at any time)',
          'Analytics/marketing cookie data: per each provider\'s own retention policy (Meta, TikTok, Google), typically between 90 days and 2 years',
        ],
      },
      {
        heading: '8. Your rights',
        paragraphs: [
          'You may exercise your rights of access, rectification, erasure, restriction of processing, portability and objection at any time, and withdraw your consent without affecting the lawfulness of prior processing. To exercise these rights, write to us at [EMAIL] stating which right you wish to exercise.',
        ],
      },
      {
        heading: '9. Right to complain to a supervisory authority',
        paragraphs: [
          'If you believe our processing of your data does not comply with the law, you have the right to file a complaint with the Spanish Data Protection Agency (AEPD) — www.aepd.es.',
        ],
      },
      {
        heading: '10. Cookies and pixels',
        paragraphs: [
          'This site uses necessary cookies of its own for basic operation and, only with your prior consent, analytics and marketing cookies:',
        ],
        list: [
          'Necessary — store your language and cookie choice. No consent required.',
          'Analytics — Google Analytics, to understand how the site is used. Only loaded if you consent.',
          'Marketing — Meta Pixel and TikTok Pixel, to measure ad campaigns. Only loaded if you consent.',
        ],
      },
    ],
  },

  ru: {
    pageTitle: 'Политика конфиденциальности',
    intro:
      'Эта Политика конфиденциальности описывает, как MJP Marine Service собирает, использует и защищает персональные данные посетителей mjpmarine.com и тех, кто отправляет свои данные через наши формы, включая формы лидов ("Lead Ads") в Meta (Facebook/Instagram).',
    updatedLabel: 'Дата последнего обновления',
    updatedValue: '16 сентября 2026 г.',
    sections: [
      {
        heading: '1. Ответственный за обработку данных',
        paragraphs: ['Ответственным за обработку данных, собираемых через этот сайт, является:'],
        list: [
          'Название компании / ИП: [НАЗВАНИЕ/ИП]',
          'NIF (испанский налоговый номер): [NIF]',
          'Адрес: [АДРЕС]',
          'Контактный email: [EMAIL]',
        ],
      },
      {
        heading: '2. Какие данные мы собираем',
        paragraphs: ['Через формы на сайте и формы лидов Meta (Facebook/Instagram) мы можем собирать:'],
        list: [
          'Имя и фамилию',
          'Телефон',
          'Email',
          'Марину, где базируется лодка',
          'Тип лодки и вид требуемого ремонта/услуги',
          'Сообщение или дополнительные комментарии, которые вы нам отправляете',
          'При подписке на рассылку: имя, email и предпочитаемый язык',
        ],
      },
      {
        heading: '3. Цели обработки',
        list: [
          'Обработка заявки на смету или ремонт и связь с вами',
          'Оказание заказанной услуги и выставление счёта, если применимо',
          'Отправка рассылки, если вы добровольно на неё подписались',
          'Оценка эффективности рекламных кампаний (Meta, TikTok, Google), если вы дали согласие на соответствующие cookie',
        ],
      },
      {
        heading: '4. Правовое основание',
        paragraphs: ['Обработка ваших данных основана на:'],
        list: [
          'Вашем согласии (ст. 6.1.a GDPR) — при отправке формы, подписке на рассылку или согласии на cookie аналитики/маркетинга',
          'Исполнении договора или преддоговорных действиях (ст. 6.1.b GDPR) — при запросе сметы или заказе услуги',
          'Законном интересе (ст. 6.1.f GDPR) — для ответа на ваше первоначальное обращение',
        ],
      },
      {
        heading: '5. Где хранятся данные',
        paragraphs: [
          'Данные хранятся в базах данных, управляемых Supabase Inc., на инфраструктуре Amazon Web Services (регион: eu-west-2, Лондон, Великобритания — страна с решением Европейской комиссии об адекватности защиты данных для международной передачи). Сам сайт размещён на Vercel Inc. Оба провайдера выступают обработчиками данных.',
        ],
      },
      {
        heading: '6. Сторонние сервисы (получатели данных)',
        paragraphs: [
          'Мы используем следующих провайдеров, которые могут получать доступ к вашим данным как обработчики, либо — в случае рекламных платформ — как самостоятельные ответственные за данные, которые они обрабатывают на своих собственных платформах:',
        ],
        list: [
          'Meta (Facebook/Instagram) — пиксель отслеживания и формы лидов (Lead Ads); только при согласии на маркетинговые cookie',
          'TikTok — рекламный пиксель отслеживания; только при согласии на маркетинговые cookie',
          'Google (Google Analytics) — аналитика использования сайта; только при согласии на аналитические cookie',
          'Resend — отправка транзакционных писем (подтверждение заявки, рассылка)',
          'Supabase — хранение базы данных',
          'Vercel — хостинг сайта',
        ],
      },
      {
        heading: '7. Срок хранения',
        list: [
          'Заявки на контакт/смету: пока существуют деловые отношения и до 1 года после последнего контакта, если не установлен более длительный срок по закону',
          'Фискальные документы (счета): 6 лет, согласно испанскому Торговому кодексу (Código de Comercio)',
          'Подписка на рассылку: до отзыва согласия (отписаться можно в любой момент)',
          'Данные аналитических/маркетинговых cookie: согласно политике хранения каждого провайдера (Meta, TikTok, Google), обычно от 90 дней до 2 лет',
        ],
      },
      {
        heading: '8. Ваши права',
        paragraphs: [
          'Вы можете в любой момент воспользоваться правом на доступ, исправление, удаление, ограничение обработки, переносимость данных и возражение, а также отозвать согласие в любой момент, не влияя на законность обработки, проведённой ранее. Чтобы воспользоваться этими правами, напишите нам на [EMAIL], указав, какое право вы хотите реализовать.',
        ],
      },
      {
        heading: '9. Право на жалобу в надзорный орган',
        paragraphs: [
          'Если вы считаете, что обработка ваших данных нарушает законодательство, вы вправе подать жалобу в Испанское агентство по защите данных (AEPD) — www.aepd.es.',
        ],
      },
      {
        heading: '10. Cookie и пиксели',
        paragraphs: [
          'Этот сайт использует собственные необходимые cookie для базовой работы и, только с вашего предварительного согласия, — аналитические и маркетинговые cookie:',
        ],
        list: [
          'Необходимые — сохраняют выбор языка и cookie. Согласие не требуется.',
          'Аналитика — Google Analytics, чтобы понимать, как используется сайт. Загружаются только при согласии.',
          'Маркетинг — Meta Pixel и TikTok Pixel, для оценки рекламных кампаний. Загружаются только при согласии.',
        ],
      },
    ],
  },

  uk: {
    pageTitle: 'Політика конфіденційності',
    intro:
      'Ця Політика конфіденційності описує, як MJP Marine Service збирає, використовує та захищає персональні дані відвідувачів mjpmarine.com і тих, хто надсилає свої дані через наші форми, зокрема форми лідів ("Lead Ads") у Meta (Facebook/Instagram).',
    updatedLabel: 'Дата останнього оновлення',
    updatedValue: '16 вересня 2026 р.',
    sections: [
      {
        heading: '1. Відповідальний за обробку даних',
        paragraphs: ['Відповідальним за обробку даних, які збираються через цей сайт, є:'],
        list: [
          'Назва компанії / ФОП: [НАЗВА/ФОП]',
          'NIF (іспанський податковий номер): [NIF]',
          'Адреса: [АДРЕСА]',
          'Контактний email: [EMAIL]',
        ],
      },
      {
        heading: '2. Які дані ми збираємо',
        paragraphs: ['Через форми на сайті та форми лідів Meta (Facebook/Instagram) ми можемо збирати:'],
        list: [
          "Ім'я та прізвище",
          'Телефон',
          'Email',
          'Марину, де базується човен',
          'Тип човна та вид необхідного ремонту/послуги',
          "Повідомлення або додаткові коментарі, які ви нам надсилаєте",
          'У разі підписки на розсилку: ім\'я, email та бажану мову',
        ],
      },
      {
        heading: '3. Цілі обробки',
        list: [
          "Обробка заявки на кошторис або ремонт і зв'язок з вами",
          'Надання замовленої послуги та виставлення рахунку, якщо застосовно',
          'Надсилання розсилки, якщо ви добровільно на неї підписалися',
          'Оцінка ефективності рекламних кампаній (Meta, TikTok, Google), якщо ви надали згоду на відповідні cookie',
        ],
      },
      {
        heading: '4. Правова підстава',
        paragraphs: ['Обробка ваших даних ґрунтується на:'],
        list: [
          'Вашій згоді (ст. 6.1.a GDPR) — під час надсилання форми, підписки на розсилку або згоди на cookie аналітики/маркетингу',
          'Виконанні договору чи переддоговірних діях (ст. 6.1.b GDPR) — під час запиту кошторису чи замовлення послуги',
          'Законному інтересі (ст. 6.1.f GDPR) — для відповіді на ваше початкове звернення',
        ],
      },
      {
        heading: '5. Де зберігаються дані',
        paragraphs: [
          'Дані зберігаються в базах даних, якими керує Supabase Inc., на інфраструктурі Amazon Web Services (регіон: eu-west-2, Лондон, Велика Британія — країна з рішенням Європейської комісії про належний рівень захисту даних для міжнародної передачі). Сам сайт розміщено на Vercel Inc. Обидва провайдери є обробниками даних.',
        ],
      },
      {
        heading: '6. Треті сторони (отримувачі даних)',
        paragraphs: [
          'Ми використовуємо наступних провайдерів, які можуть отримувати доступ до ваших даних як обробники, або — у разі рекламних платформ — як самостійні відповідальні за дані, які вони обробляють на власних платформах:',
        ],
        list: [
          'Meta (Facebook/Instagram) — піксель відстеження та форми лідів (Lead Ads); лише за згодою на маркетингові cookie',
          'TikTok — рекламний піксель відстеження; лише за згодою на маркетингові cookie',
          'Google (Google Analytics) — аналітика використання сайту; лише за згодою на аналітичні cookie',
          'Resend — надсилання транзакційних листів (підтвердження заявки, розсилка)',
          'Supabase — зберігання бази даних',
          'Vercel — хостинг сайту',
        ],
      },
      {
        heading: '7. Строк зберігання',
        list: [
          "Заявки на контакт/кошторис: поки тривають ділові відносини і до 1 року після останнього контакту, якщо законом не встановлено довший строк",
          'Фіскальні документи (рахунки): 6 років, згідно з іспанським Торговим кодексом (Código de Comercio)',
          'Підписка на розсилку: до відкликання згоди (відписатися можна в будь-який момент)',
          'Дані аналітичних/маркетингових cookie: згідно з політикою зберігання кожного провайдера (Meta, TikTok, Google), зазвичай від 90 днів до 2 років',
        ],
      },
      {
        heading: '8. Ваші права',
        paragraphs: [
          'Ви можете в будь-який момент скористатися правом на доступ, виправлення, видалення, обмеження обробки, перенесення даних та заперечення, а також відкликати згоду в будь-який момент, не впливаючи на законність обробки, проведеної раніше. Щоб скористатися цими правами, напишіть нам на [EMAIL], зазначивши, яке право ви бажаєте реалізувати.',
        ],
      },
      {
        heading: '9. Право на скаргу до наглядового органу',
        paragraphs: [
          'Якщо ви вважаєте, що обробка ваших даних порушує законодавство, ви маєте право подати скаргу до Іспанського агентства із захисту даних (AEPD) — www.aepd.es.',
        ],
      },
      {
        heading: '10. Cookie та пікселі',
        paragraphs: [
          'Цей сайт використовує власні необхідні cookie для базової роботи та, лише за вашою попередньою згодою, — аналітичні й маркетингові cookie:',
        ],
        list: [
          'Необхідні — зберігають вибір мови та cookie. Згода не потрібна.',
          'Аналітика — Google Analytics, щоб розуміти, як використовується сайт. Завантажуються лише за згодою.',
          'Маркетинг — Meta Pixel і TikTok Pixel, для оцінки рекламних кампаній. Завантажуються лише за згодою.',
        ],
      },
    ],
  },
};
