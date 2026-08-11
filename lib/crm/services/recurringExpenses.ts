import type { PrismaClient, RecurrenceFrequency } from '@prisma/client'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { nextFinanceAutoId } from '@/lib/crm/numbering'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// ISO-неделя (год+номер недели) — используется как ключ периода для WEEKLY.
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`
}

export function periodKeyFor(frequency: RecurrenceFrequency, date: Date): string {
  if (frequency === 'MONTHLY') return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
  if (frequency === 'YEARLY') return `${date.getFullYear()}`
  return isoWeekKey(date)
}

function dueDateFor(frequency: RecurrenceFrequency, period: string, dayOfMonth: number, monthOfYear: number | null): Date {
  if (frequency === 'MONTHLY') {
    const [y, m] = period.split('-').map(Number)
    return new Date(y, m - 1, Math.min(dayOfMonth, 28))
  }
  if (frequency === 'YEARLY') {
    const y = Number(period)
    return new Date(y, (monthOfYear ?? 1) - 1, Math.min(dayOfMonth, 28))
  }
  // WEEKLY: понедельник этой ISO-недели
  const [y, w] = period.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (w - 1) * 7)
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())
}

function stepBack(frequency: RecurrenceFrequency, date: Date): Date {
  const d = new Date(date)
  if (frequency === 'MONTHLY') d.setMonth(d.getMonth() - 1)
  else if (frequency === 'YEARLY') d.setFullYear(d.getFullYear() - 1)
  else d.setDate(d.getDate() - 7)
  return d
}

const MAX_BACKFILL_PERIODS = 24

// Догенерировать недостающие occurrence для активных шаблонов компании —
// от текущего периода назад до создания шаблона, с потолком в 24 периода
// (защита от аномально старых шаблонов/давно не запускавшегося крона).
// Идемпотентно: @@unique([recurringExpenseId, period]) не даёт задвоить.
export async function ensureOccurrences(companyId: string): Promise<number> {
  const templates = await prisma.recurringExpense.findMany({ where: { companyId, active: true } })
  let created = 0

  for (const tpl of templates) {
    let cursor = new Date()
    for (let i = 0; i < MAX_BACKFILL_PERIODS; i++) {
      if (cursor < tpl.createdAt && periodKeyFor(tpl.frequency, cursor) !== periodKeyFor(tpl.frequency, tpl.createdAt)) break
      const period = periodKeyFor(tpl.frequency, cursor)
      const existing = await prisma.recurringExpenseOccurrence.findUnique({
        where: { recurringExpenseId_period: { recurringExpenseId: tpl.id, period } },
      })
      if (!existing) {
        await prisma.recurringExpenseOccurrence.create({
          data: {
            recurringExpenseId: tpl.id,
            period,
            dueDate: dueDateFor(tpl.frequency, period, tpl.dayOfMonth, tpl.monthOfYear),
          },
        })
        created++
      }
      cursor = stepBack(tpl.frequency, cursor)
    }
  }
  return created
}

// Подтвердить occurrence: создаёт FinanceEntry (EXPENSE) по шаблону, помечает
// occurrence CONFIRMED. Идемпотентно — повторный вызов на уже подтверждённом
// occurrence ничего не делает (защита от задвоения при двойном клике).
export async function confirmOccurrence(
  tx: Tx,
  companyId: string,
  occurrenceId: string,
): Promise<{ ok: true; skipped?: true } > {
  const occurrence = await tx.recurringExpenseOccurrence.findFirst({
    where: { id: occurrenceId, recurringExpense: { companyId } },
    include: { recurringExpense: true },
  })
  if (!occurrence) throw new Error('Не найдено')
  if (occurrence.status !== 'PENDING') return { ok: true, skipped: true }

  const tpl = occurrence.recurringExpense
  const year = occurrence.dueDate.getFullYear()
  const autoId = await nextFinanceAutoId(companyId, 'EXPENSE', year)
  const amount = new Decimal(tpl.amount.toString())

  const entry = await tx.financeEntry.create({
    data: {
      companyId,
      autoId,
      type: 'EXPENSE',
      date: occurrence.dueDate,
      category: tpl.category,
      categoryId: tpl.categoryId,
      amountExpr: amount.toString(),
      amount,
      paymentMethod: tpl.paymentMethod,
      description: tpl.description || `Повторяющийся расход: ${tpl.category}`,
    },
  })

  await tx.recurringExpenseOccurrence.update({
    where: { id: occurrence.id },
    data: { status: 'CONFIRMED', financeEntryId: entry.id, confirmedAt: new Date() },
  })

  return { ok: true }
}

export async function skipOccurrence(companyId: string, occurrenceId: string): Promise<void> {
  const occurrence = await prisma.recurringExpenseOccurrence.findFirst({
    where: { id: occurrenceId, recurringExpense: { companyId } },
  })
  if (!occurrence || occurrence.status !== 'PENDING') return
  await prisma.recurringExpenseOccurrence.update({ where: { id: occurrence.id }, data: { status: 'SKIPPED' } })
}
