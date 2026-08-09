import Decimal from 'decimal.js'

// Локальная календарная дата в формате YYYY-MM-DD.
// НЕ использовать d.toISOString().slice(0,10) для этой цели — toISOString()
// конвертирует в UTC, и для часовых поясов восточнее UTC (Europe/Madrid, UTC+1/+2)
// локальная полночь откатывается на предыдущий день. Именно так планировщик
// (drag-and-drop в недельной сетке) сохранял задачи не на тот день.
export function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Безопасная арифметика суммы: "168.23/2" → Decimal("84.115")
// Допустимы только числа и операторы + - * /
export function parseAmountExpr(expr: string): Decimal {
  const clean = expr.trim()
  if (!clean) return new Decimal(0)

  // Только числа, пробелы и базовые операторы
  if (!/^[\d\s.+\-*/()]+$/.test(clean)) {
    const num = parseFloat(clean)
    if (isNaN(num)) throw new Error(`Некорректное выражение: ${expr}`)
    return new Decimal(clean)
  }

  // Безопасный eval через Function с ограниченным контекстом
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${clean})`)()
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Результат не является числом')
    }
    return new Decimal(result.toString())
  } catch {
    throw new Error(`Ошибка вычисления выражения: ${expr}`)
  }
}

// Форматирование EUR через Intl — результат: «1 234,56 €»
// Отрицательные суммы возвращаются с минусом (UI красит через класс danger)
const EUR_FMT = new Intl.NumberFormat('ru-RU', {
  style:    'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: Decimal | number | string): string {
  const n = new Decimal(amount.toString()).toNumber()
  return EUR_FMT.format(n)
}

export function isNegativeMoney(amount: Decimal | number | string): boolean {
  return new Decimal(amount.toString()).isNegative()
}

// Объединение классов Tailwind (аналог cn из shadcn)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Цвета статусов задач
export const TASK_STATUS_COLORS: Record<string, string> = {
  NEW:         'bg-gray-400',
  SCHEDULED:   'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  DONE:        'bg-green-500',
  PROBLEM:     'bg-red-500',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW:         'Новая',
  SCHEDULED:   'Запланирована',
  IN_PROGRESS: 'В работе',
  DONE:        'Выполнена',
  PROBLEM:     'Проблема',
}

export const FUNNEL_STAGE_LABELS: Record<string, string> = {
  NEW_LEAD:       'Новый лид',
  CONTACT_MADE:   'Контакт установлен',
  QUOTE_SENT:     'Предварительная оценка',
  WORK_SCHEDULED: 'Работа запланирована',
  WORK_DONE:      'Выполнено',
  INVOICE_SENT:   'Счёт выставлен',
  PAID:           'Оплачено',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  ISSUED:    'Выставлен',
  PARTIAL:   'Частично оплачен',
  PAID:      'Оплачен',
  OVERDUE:   'Просрочен',
  CANCELLED: 'Отменён',
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT:    'Черновик',
  SENT:     'Отправлен',
  ACCEPTED: 'Принят',
  REJECTED: 'Отклонён',
}

export const LANGUAGE_LABELS: Record<string, string> = {
  ru: '🇷🇺 Русский',
  en: '🇬🇧 English',
  es: '🇪🇸 Español',
  uk: '🇺🇦 Українська',
  pl: '🇵🇱 Polski',
}

export const PAYMENT_METHODS = ['Наличные', 'Карта', 'Перевод', 'Bizum']