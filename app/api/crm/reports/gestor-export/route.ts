import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { INVOICE_STATUS_LABELS } from '@/lib/crm/utils'

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const QUARTER_OF = (monthIdx: number) => Math.floor(monthIdx / 3) + 1

function n(d: unknown): number {
  return Number(new Decimal(String(d)).toFixed(2))
}

// GET /api/crm/reports/gestor-export?year=2026 — выгрузка для бухгалтера:
// счета (база/IVA/итог/статус оплаты), P&L по месяцам (нетто), IVA-книга по
// кварталам (repercutido/soportado/к уплате). Расчёт налогов и modelo 303 —
// не здесь, это отдельная задача бухгалтера; это только выгрузка исходных цифр.
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'REPORTS', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? '') || new Date().getFullYear()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const companyId = session.user.companyId

  const [invoices, financeEntries, vatEntries] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, date: { gte: yearStart, lt: yearEnd }, status: { not: 'DRAFT' } },
      orderBy: { date: 'asc' },
    }),
    prisma.financeEntry.findMany({
      where: { companyId, date: { gte: yearStart, lt: yearEnd } },
      select: { type: true, amount: true, date: true },
    }),
    prisma.vatEntry.findMany({
      where: { companyId, date: { gte: yearStart, lt: yearEnd } },
      select: { direction: true, amount: true, date: true },
    }),
  ])

  // ── Лист 1: Счета ──────────────────────────────────────────────────────
  const invoicesSheet = XLSX.utils.aoa_to_sheet([
    ['Номер', 'Дата', 'Клиент', 'NIF', 'База (нетто)', 'Ставка IVA %', 'IVA', 'IRPF', 'Итого', 'Статус оплаты'],
    ...invoices.map((i) => [
      i.number,
      i.date.toLocaleDateString('ru-RU'),
      i.clientName,
      i.clientNif,
      n(i.subtotal),
      n(i.ivaRate),
      n(i.ivaAmount),
      n(i.irpfAmount),
      n(i.total),
      INVOICE_STATUS_LABELS[i.status] ?? i.status,
    ]),
    [],
    ['', '', '', 'Итого:', n(invoices.reduce((s, i) => s.plus(i.subtotal.toString()), new Decimal(0))), '',
      n(invoices.reduce((s, i) => s.plus(i.ivaAmount.toString()), new Decimal(0))),
      n(invoices.reduce((s, i) => s.plus(i.irpfAmount.toString()), new Decimal(0))),
      n(invoices.reduce((s, i) => s.plus(i.total.toString()), new Decimal(0))), ''],
  ])

  // ── Лист 2: P&L по месяцам (нетто — IVA сюда никогда не входит) ────────
  const monthTotals = Array.from({ length: 12 }, () => ({ income: new Decimal(0), expense: new Decimal(0), salary: new Decimal(0) }))
  for (const f of financeEntries) {
    const m = f.date.getMonth()
    const amt = new Decimal(f.amount.toString())
    if (f.type === 'INCOME') monthTotals[m].income = monthTotals[m].income.plus(amt)
    else if (f.type === 'EXPENSE') monthTotals[m].expense = monthTotals[m].expense.plus(amt)
    else monthTotals[m].salary = monthTotals[m].salary.plus(amt)
  }
  const plYearTotals = monthTotals.reduce((acc, m) => ({
    income: acc.income.plus(m.income), expense: acc.expense.plus(m.expense), salary: acc.salary.plus(m.salary),
  }), { income: new Decimal(0), expense: new Decimal(0), salary: new Decimal(0) })

  const plSheet = XLSX.utils.aoa_to_sheet([
    ['Месяц', 'Доход (нетто)', 'Расход', 'Зарплата', 'P&L (нетто)'],
    ...monthTotals.map((m, i) => [
      MONTHS_RU[i], n(m.income), n(m.expense), n(m.salary), n(m.income.minus(m.expense).minus(m.salary)),
    ]),
    [],
    ['Итого за год', n(plYearTotals.income), n(plYearTotals.expense), n(plYearTotals.salary),
      n(plYearTotals.income.minus(plYearTotals.expense).minus(plYearTotals.salary))],
  ])

  // ── Лист 3: IVA-книга по кварталам ──────────────────────────────────────
  const quarterTotals = Array.from({ length: 4 }, () => ({ repercutido: new Decimal(0), soportado: new Decimal(0) }))
  for (const v of vatEntries) {
    const q = QUARTER_OF(v.date.getMonth()) - 1
    if (v.direction === 'REPERCUTIDO') quarterTotals[q].repercutido = quarterTotals[q].repercutido.plus(v.amount.toString())
    else quarterTotals[q].soportado = quarterTotals[q].soportado.plus(v.amount.toString())
  }
  const vatYearTotals = quarterTotals.reduce((acc, q) => ({
    repercutido: acc.repercutido.plus(q.repercutido), soportado: acc.soportado.plus(q.soportado),
  }), { repercutido: new Decimal(0), soportado: new Decimal(0) })

  const vatSheet = XLSX.utils.aoa_to_sheet([
    ['Квартал', 'IVA repercutido (собран с клиентов)', 'IVA soportado (уплачен поставщикам)', 'К уплате (repercutido − soportado)'],
    ...quarterTotals.map((q, i) => [
      `Q${i + 1}`, n(q.repercutido), n(q.soportado), n(q.repercutido.minus(q.soportado)),
    ]),
    [],
    ['Итого за год', n(vatYearTotals.repercutido), n(vatYearTotals.soportado), n(vatYearTotals.repercutido.minus(vatYearTotals.soportado))],
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, invoicesSheet, 'Счета')
  XLSX.utils.book_append_sheet(wb, plSheet, 'P&L по месяцам')
  XLSX.utils.book_append_sheet(wb, vatSheet, 'IVA по кварталам')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="MJP-gestor-${year}.xlsx"`,
    },
  })
}
