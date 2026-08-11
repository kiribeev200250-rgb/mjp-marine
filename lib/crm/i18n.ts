// Механизм переключения языка интерфейса CRM — задел под будущих сотрудников
// (RU основной язык бизнеса, ES для будущих испанских сотрудников). НЕ
// переведено полностью: см. промпт E, п.5 — "не обязательно переводить всё
// идеально сейчас, заложить механизм и покрыть основное". Переведён каркас
// (сайдбар/топбар) — единственное, что видно на КАЖДОМ экране одновременно;
// содержимое самих экранов (Клиенты/Финансы/…) остаётся на русском.
// Язык документа (счёт/пресмет: RU/ES/UK/PL) — отдельное поле Invoice.language,
// не связан с языком интерфейса вообще.
export type CrmLang = 'ru' | 'es'

export const CRM_LANGS: CrmLang[] = ['ru', 'es']

export const CRM_LANG_LABEL: Record<CrmLang, string> = {
  ru: 'Русский',
  es: 'Español',
}

export const CRM_DICT: Record<CrmLang, Record<string, string>> = {
  ru: {
    dashboard:  'Дашборд',
    clients:    'Клиенты',
    funnel:     'Воронка',
    schedule:   'Планировщик',
    inventory:  'Склад',
    finance:    'Финансы',
    invoices:   'Счета',
    reports:    'Аналитика',
    settings:   'Настройки',
    styleGuide: 'Style Guide',
    logout:     'Выйти',
    search:     'Поиск клиентов, счетов, задач…',
    newOperation: '+ Операция',
    crmSubtitle: 'CRM',
    admin:      'Администратор',
    employee:   'Сотрудник',
    language:   'Язык интерфейса',
  },
  es: {
    dashboard:  'Panel',
    clients:    'Clientes',
    funnel:     'Embudo',
    schedule:   'Planificador',
    inventory:  'Almacén',
    finance:    'Finanzas',
    invoices:   'Facturas',
    reports:    'Informes',
    settings:   'Ajustes',
    styleGuide: 'Guía de estilo',
    logout:     'Salir',
    search:     'Buscar clientes, facturas, tareas…',
    newOperation: '+ Operación',
    crmSubtitle: 'CRM',
    admin:      'Administrador',
    employee:   'Empleado',
    language:   'Idioma de la interfaz',
  },
}

export const CRM_LANG_STORAGE_KEY = 'crm_lang'
