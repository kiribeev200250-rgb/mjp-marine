import { redirect } from 'next/navigation'
import Link from 'next/link'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, isNegativeMoney } from '@/lib/crm/utils'
import { ExportCsvButton } from '@/components/crm/ui'
import { PLGrid, type PLCategory, type PLEntry } from '@/components/crm/reports/PLGrid'
import { VatGrid, type VatEntryRow } from '@/components/crm/reports/VatGrid'
import { computeCashSummary } from '@/lib/crm/services/cash'

interface SearchParams { year?: string }

const AD_CATEGORIES = ['Реклама — Facebook', 'Реклама — Google', 'Реклама — TikTok', 'Реклама — другое']
const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

export default async function PLReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'REPORTS', 'VIEW')

  const companyId = session.user.companyId
  const now = new Date()
  const year = parseInt(sp.year ?? '') || now.getFullYear()
  const yearStart = new Date(year, 0, 1)
  const yearEnd   = new Date(year + 1, 0, 1)
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  // Окно для прогноза: последние 3 полных месяца + текущий (по факту на сегодня)
  const forecastStart = new Date(today.getFullYear(), today.getMonth() - 3, 1)

  const [
    categories,
    yearEntriesRaw,
    cashSummary,
    vatEntriesYearRaw,
    outstandingInvoices,
    paidInvoicesYear,
    leadsCount,
    quotesCreated,
    quotesAccepted,
    invoicesPaidCount,
    topClientAgg,
    adSpendYear,
    forecastEntriesRaw,
    inventoryItems,
  ] = await Promise.all([
    prisma.category.findMany({ where: { companyId, archived: false }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.financeEntry.findMany({
      where:  { companyId, date: { gte: yearStart, lt: yearEnd } },
      select: { id: true, categoryId: true, category: true, type: true, amount: true, date: true, autoId: true, description: true, paymentMethod: true },
    }),
    // Касса и капитал — единая формула, см. lib/crm/services/cash.ts
    computeCashSummary(companyId),
    prisma.vatEntry.findMany({
      where:   { companyId, date: { gte: yearStart, lt: yearEnd } },
      include: {
        invoice:      { select: { id: true, number: true } },
        financeEntry: { select: { autoId: true, description: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.invoice.findMany({
      where:   { companyId, status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.invoice.findMany({
      where:   { companyId, status: 'PAID', paidAt: { gte: yearStart, lt: yearEnd } },
      include: { client: { select: { marina: true } } },
    }),
    prisma.client.count({ where: { companyId, active: true, createdAt: { gte: yearStart, lt: yearEnd } } }),
    prisma.quote.count({ where: { companyId, createdAt: { gte: yearStart, lt: yearEnd } } }),
    prisma.quote.count({ where: { companyId, status: 'ACCEPTED', acceptedAt: { gte: yearStart, lt: yearEnd } } }),
    prisma.invoice.count({ where: { companyId, status: 'PAID', paidAt: { gte: yearStart, lt: yearEnd } } }),
    prisma.invoice.groupBy({
      by: ['clientId'], where: { companyId, status: 'PAID', paidAt: { gte: yearStart, lt: yearEnd } },
      _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 8,
    }),
    prisma.financeEntry.groupBy({
      by: ['category'], where: { companyId, type: 'EXPENSE', category: { in: AD_CATEGORIES }, date: { gte: yearStart, lt: yearEnd } }, _sum: { amount: true },
    }),
    prisma.financeEntry.findMany({
      where:  { companyId, date: { gte: forecastStart, lt: yearEnd > now ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : yearEnd }, type: { in: ['INCOME', 'EXPENSE', 'SALARY'] } },
      select: { type: true, amount: true, date: true },
    }),
    prisma.inventoryItem.findMany({ where: { companyId, active: true }, select: { name: true, qtyInStock: true, qtyMinAlert: true, costPrice: true } }),
  ])

  const plCategories: PLCategory[] = categories.map((c) => ({ id: c.id, kind: c.kind as 'INCOME' | 'EXPENSE', name: c.name }))
  const plEntries: PLEntry[] = yearEntriesRaw.map((e) => ({
    id: e.id, categoryId: e.categoryId, category: e.category, type: e.type,
    amount: e.amount.toString(), date: e.date.toISOString(), autoId: e.autoId,
    description: e.description, paymentMethod: e.paymentMethod,
  }))

  const vatEntriesYear: VatEntryRow[] = vatEntriesYearRaw.map((e) => ({
    id: e.id, direction: e.direction, date: e.date.toISOString(),
    amount: e.amount.toString(), baseAmount: e.baseAmount.toString(), rate: e.rate.toString(),
    note: e.note, invoiceId: e.invoice?.id ?? null, invoiceNumber: e.invoice?.number ?? null,
    financeAutoId: e.financeEntry?.autoId ?? null,
  }))

  // ── CSV rows (тот же расчёт, что в PLGrid — единый источник данных: yearEntriesRaw) ──
  function sumsByMonth(filter: (e: (typeof yearEntriesRaw)[number]) => boolean) {
    const months = Array.from({ length: 12 }, () => new Decimal(0))
    for (const e of yearEntriesRaw) {
      if (!filter(e)) continue
      const m = e.date.getMonth()
      months[m] = months[m].plus(e.amount.toString())
    }
    return months
  }
  const csvRows: (string | number)[][] = []
  const incomeCats = plCategories.filter((c) => c.kind === 'INCOME')
  const expenseCats = plCategories.filter((c) => c.kind === 'EXPENSE')
  csvRows.push(['ДОХОДЫ'])
  for (const cat of incomeCats) {
    const months = sumsByMonth((e) => e.categoryId === cat.id)
    csvRows.push([cat.name, ...months.map((m) => m.toNumber()), months.reduce((s, m) => s.plus(m), new Decimal(0)).toNumber()])
  }
  const monthIncomeTotal = sumsByMonth((e) => e.type === 'INCOME')
  csvRows.push(['Итого доходы', ...monthIncomeTotal.map((m) => m.toNumber()), monthIncomeTotal.reduce((s, m) => s.plus(m), new Decimal(0)).toNumber()])
  csvRows.push(['РАСХОДЫ'])
  for (const cat of expenseCats) {
    const months = sumsByMonth((e) => e.categoryId === cat.id)
    csvRows.push([cat.name, ...months.map((m) => m.toNumber()), months.reduce((s, m) => s.plus(m), new Decimal(0)).toNumber()])
  }
  const monthExpenseTotal = sumsByMonth((e) => e.type === 'EXPENSE')
  csvRows.push(['Итого расходы', ...monthExpenseTotal.map((m) => m.toNumber()), monthExpenseTotal.reduce((s, m) => s.plus(m), new Decimal(0)).toNumber()])
  const monthSalaryTotal = sumsByMonth((e) => e.type === 'SALARY')
  csvRows.push(['Зарплаты (ФОТ)', ...monthSalaryTotal.map((m) => m.toNumber()), monthSalaryTotal.reduce((s, m) => s.plus(m), new Decimal(0)).toNumber()])
  const monthProfit = monthIncomeTotal.map((inc, i) => inc.minus(monthExpenseTotal[i]).minus(monthSalaryTotal[i]))
  csvRows.push(['ПРИБЫЛЬ / УБЫТОК', ...monthProfit.map((m) => m.toNumber()), monthProfit.reduce((s, m) => s.plus(m), new Decimal(0)).toNumber()])

  // ── Блок 2: капитал и касса ──────────────────────────────────────────────
  const { reinvested, startupAsset, startupSunk, totalInvested, cash, personalInProject, vatRepercutido, vatSoportado, vatPayable } = cashSummary

  const plYearTotal  = monthProfit.reduce((s, m) => s.plus(m), new Decimal(0))
  const currentMonthIdx = year === today.getFullYear() ? today.getMonth() : null
  const plCurrentMonth = currentMonthIdx !== null ? monthProfit[currentMonthIdx] : new Decimal(0)

  // ── Блок 3: клиентские/операционные показатели ───────────────────────────
  const outstandingSum = outstandingInvoices.reduce((s, i) => s.plus(i.total.toString()), new Decimal(0))
  const overdueList = outstandingInvoices
    .filter((i) => i.dueDate && i.dueDate < today)
    .map((i) => ({ ...i, daysOverdue: daysBetween(today, i.dueDate!) }))

  const marinaMap = new Map<string, Decimal>()
  for (const inv of paidInvoicesYear) {
    const marina = inv.client.marina || 'Без марины'
    marinaMap.set(marina, (marinaMap.get(marina) ?? new Decimal(0)).plus(inv.total.toString()))
  }
  const revenueByMarina = [...marinaMap.entries()].sort((a, b) => b[1].comparedTo(a[1])).slice(0, 8)

  const revenueByCategory = incomeCats
    .map((c) => ({ name: c.name, sum: sumsByMonth((e) => e.categoryId === c.id).reduce((s, m) => s.plus(m), new Decimal(0)) }))
    .filter((c) => c.sum.gt(0))
    .sort((a, b) => b.sum.comparedTo(a.sum))
    .slice(0, 8)

  const topClientIds = topClientAgg.map((c) => c.clientId)
  const topClients = topClientIds.length > 0
    ? await prisma.client.findMany({ where: { id: { in: topClientIds } }, select: { id: true, firstName: true, lastName: true } })
    : []
  const topClientsWithTotals = topClientAgg
    .map((agg) => ({ client: topClients.find((c) => c.id === agg.clientId), total: new Decimal(agg._sum.total?.toString() ?? 0) }))
    .filter((c): c is { client: NonNullable<typeof c.client>; total: Decimal } => !!c.client)

  const avgTicket = paidInvoicesYear.length > 0
    ? paidInvoicesYear.reduce((s, i) => s.plus(i.total.toString()), new Decimal(0)).div(paidInvoicesYear.length)
    : new Decimal(0)

  const adByChannel = adSpendYear.map((c) => ({ label: c.category.replace('Реклама — ', ''), amount: new Decimal(c._sum.amount?.toString() ?? 0) }))
  const totalAdSpend = adByChannel.reduce((s, c) => s.plus(c.amount), new Decimal(0))
  const totalRevenueYear = monthIncomeTotal.reduce((s, m) => s.plus(m), new Decimal(0))
  const blendedCpl  = leadsCount > 0 ? totalAdSpend.div(leadsCount) : null
  const blendedRomi = totalAdSpend.gt(0) ? totalRevenueYear.minus(totalAdSpend).div(totalAdSpend).mul(100) : null

  const stockValue = inventoryItems.reduce((s, i) => s.plus(new Decimal(i.qtyInStock.toString()).times(i.costPrice.toString())), new Decimal(0))
  const lowStockItems = inventoryItems.filter((i) => Number(i.qtyMinAlert) > 0 && Number(i.qtyInStock) < Number(i.qtyMinAlert) && Number(i.qtyInStock) >= 0)
  const negativeStockItems = inventoryItems.filter((i) => Number(i.qtyInStock) < 0)

  // ── Блок 4: прогноз ───────────────────────────────────────────────────────
  const monthKeys: string[] = []
  for (let i = 3; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${d.getMonth()}`)
  }
  const byMonthKey = new Map<string, { income: Decimal; expense: Decimal; salary: Decimal }>()
  for (const key of monthKeys) byMonthKey.set(key, { income: new Decimal(0), expense: new Decimal(0), salary: new Decimal(0) })
  for (const e of forecastEntriesRaw) {
    const key = `${e.date.getFullYear()}-${e.date.getMonth()}`
    const bucket = byMonthKey.get(key)
    if (!bucket) continue
    const amt = new Decimal(e.amount.toString())
    if (e.type === 'INCOME') bucket.income = bucket.income.plus(amt)
    if (e.type === 'EXPENSE') bucket.expense = bucket.expense.plus(amt)
    if (e.type === 'SALARY') bucket.salary = bucket.salary.plus(amt)
  }
  // Последние 3 ЗАВЕРШЁННЫХ месяца (без текущего, ещё не закрытого) — для средних и прогноза
  const completedKeys = monthKeys.slice(0, 3)
  const completedBuckets = completedKeys.map((k) => byMonthKey.get(k)!)
  const avgIncome  = completedBuckets.reduce((s, b) => s.plus(b.income), new Decimal(0)).div(completedBuckets.length || 1)
  const avgExpense = completedBuckets.reduce((s, b) => s.plus(b.expense), new Decimal(0)).div(completedBuckets.length || 1)
  const avgSalary  = completedBuckets.reduce((s, b) => s.plus(b.salary), new Decimal(0)).div(completedBuckets.length || 1)
  const avgProfit  = avgIncome.minus(avgExpense).minus(avgSalary)
  const breakEven  = avgExpense.plus(avgSalary)

  const lastProfit = completedBuckets[2] ? completedBuckets[2].income.minus(completedBuckets[2].expense).minus(completedBuckets[2].salary) : new Decimal(0)
  const prevProfit  = completedBuckets[1] ? completedBuckets[1].income.minus(completedBuckets[1].expense).minus(completedBuckets[1].salary) : new Decimal(0)
  const trendPct = prevProfit.abs().gt(0) ? lastProfit.minus(prevProfit).div(prevProfit.abs()).mul(100) : null

  const prevYear = year - 1
  const nextYear = year + 1

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/crm/reports" className="text-gray-500 hover:text-gray-900 text-body transition">← Аналитика</Link>
          <span className="text-gray-500">/</span>
          <h1 className="text-heading font-bold text-gray-900">P&L — финансовый центр</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href={`/api/crm/reports/gestor-export?year=${year}`} className="text-body text-info hover:underline">
            Скачать для бухгалтера ({year})
          </a>
          <div className="flex items-center gap-2">
            <Link href={`?year=${prevYear}`} className="px-2.5 py-1 rounded-control border border-gray-200 text-label text-gray-500 hover:bg-gray-50 transition">‹</Link>
            <span className="text-body font-semibold text-gray-900 min-w-[60px] text-center">{year}</span>
            <Link href={`?year=${nextYear}`} className={`px-2.5 py-1 rounded-control border border-gray-200 text-label text-gray-500 hover:bg-gray-50 transition ${year >= today.getFullYear() ? 'opacity-30 pointer-events-none' : ''}`}>›</Link>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Блок 2 — Капитал и касса */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
          <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Капитал и касса</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-3">
            <Metric label="Вложено всего" value={formatMoney(totalInvested)} />
            <Metric label="— доинвестиции" value={formatMoney(reinvested)} sub />
            <Metric label="— стартовые (актив)" value={formatMoney(startupAsset)} sub />
            <Metric label="— стартовые (невозврат.)" value={formatMoney(startupSunk)} sub />
            <Metric label="Касса" value={formatMoney(cash)} danger={isNegativeMoney(cash)} />
            <Metric label="— из них IVA к уплате" value={vatPayable.gt(0) ? formatMoney(vatPayable) : '—'} sub danger={vatPayable.gt(0)} />
            <Metric label="Личные в проекте" value={personalInProject.gt(0) ? formatMoney(personalInProject) : '—'} danger={personalInProject.gt(0)} />
            <Metric label={`P&L за ${year}`} value={formatMoney(plYearTotal)} danger={isNegativeMoney(plYearTotal)} />
          </div>
        </div>

        {/* Блок IVA — repercutido / soportado / к уплате по кварталам */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
          <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-1">IVA · {year}</h2>
          <p className="text-label text-gray-500 mb-3">Не прибыль и не расход — деньги для государства. Только для контроля и modelo 303.</p>
          {vatEntriesYear.length === 0 ? (
            <p className="text-body text-gray-500 text-center py-4">За {year} год операций с IVA нет</p>
          ) : (
            <VatGrid entries={vatEntriesYear} />
          )}
        </div>

        {/* Блок 1 — P&L таблица */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold">P&L по месяцам × категориям · {year}</h2>
            <ExportCsvButton
              filename={`pl-${year}`}
              headers={['Категория', ...MONTHS_SHORT, 'Итого']}
              rows={csvRows}
            />
          </div>
          <PLGrid categories={plCategories} entries={plEntries} />
          <p className="text-label text-gray-500 mt-2">Клик по числу раскрывает операции, из которых оно сложилось.</p>
        </div>

        {/* Блок 3 — клиентские/операционные показатели */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Дебиторка — {formatMoney(outstandingSum)}</h2>
            {overdueList.length === 0 ? (
              <p className="text-body text-gray-500 text-center py-4">Просрочек нет</p>
            ) : (
              <table className="w-full text-body">
                <thead>
                  <tr className="text-label text-gray-500 uppercase tracking-wide">
                    <th className="text-left font-semibold pb-1.5">Счёт</th>
                    <th className="text-left font-semibold pb-1.5">Клиент</th>
                    <th className="text-right font-semibold pb-1.5">Дней</th>
                    <th className="text-right font-semibold pb-1.5">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueList.map((inv) => (
                    <tr key={inv.id} className="border-t border-gray-50">
                      <td className="py-1.5"><Link href={`/crm/invoices/${inv.id}`} className="font-mono text-gray-900 hover:text-gold transition">{inv.number}</Link></td>
                      <td className="py-1.5"><Link href={`/crm/clients/${inv.client.id}`} className="text-gray-700 hover:text-gold transition">{inv.clientName}</Link></td>
                      <td className="py-1.5 text-right tabular-nums text-danger font-medium">{inv.daysOverdue}</td>
                      <td className="py-1.5 text-right tabular-nums text-danger font-medium">{formatMoney(inv.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Конверсия воронки · {year}</h2>
            <NumRow label="Лиды" value={leadsCount} />
            <NumRow label="Сметы созданы" value={quotesCreated} pct={leadsCount > 0 ? (quotesCreated / leadsCount) * 100 : null} />
            <NumRow label="Сметы приняты" value={quotesAccepted} pct={leadsCount > 0 ? (quotesAccepted / leadsCount) * 100 : null} />
            <NumRow label="Счетов оплачено" value={invoicesPaidCount} pct={leadsCount > 0 ? (invoicesPaidCount / leadsCount) * 100 : null} />
            <div className="border-t border-gray-100 mt-2 pt-2">
              <NumRow label="Средний чек" value={formatMoney(avgTicket)} />
              <NumRow label="Сделок (оплачено)" value={paidInvoicesYear.length} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Выручка по видам работ</h2>
            {revenueByCategory.length === 0 ? <p className="text-body text-gray-500 text-center py-4">Нет данных</p> :
              revenueByCategory.map((c) => <NumRow key={c.name} label={c.name} value={formatMoney(c.sum)} />)}
          </div>
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Выручка по маринам</h2>
            {revenueByMarina.length === 0 ? <p className="text-body text-gray-500 text-center py-4">Нет данных</p> :
              revenueByMarina.map(([label, sum]) => <NumRow key={label} label={label} value={formatMoney(sum)} />)}
          </div>
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Топ-клиенты</h2>
            {topClientsWithTotals.length === 0 ? <p className="text-body text-gray-500 text-center py-4">Нет данных</p> :
              topClientsWithTotals.map(({ client, total }) => (
                <NumRow key={client.id} label={<Link href={`/crm/clients/${client.id}`} className="hover:text-gold transition">{client.firstName} {client.lastName}</Link>} value={formatMoney(total)} />
              ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Реклама по каналам · {year}</h2>
            {adByChannel.every((c) => c.amount.eq(0)) ? (
              <p className="text-body text-gray-500 text-center py-4">Расходов на рекламу нет</p>
            ) : adByChannel.map((c) => <NumRow key={c.label} label={c.label} value={formatMoney(c.amount)} />)}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <NumRow label="Блендед CPL" value={blendedCpl ? formatMoney(blendedCpl) : '—'} />
              <NumRow label="Блендед ROMI" value={blendedRomi ? `${blendedRomi.toFixed(0)}%` : '—'} danger={blendedRomi ? blendedRomi.isNegative() : false} />
            </div>
          </div>

          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
            <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Склад</h2>
            <NumRow label="Стоимость остатков" value={formatMoney(stockValue)} />
            <NumRow label="Ниже точки заказа" value={lowStockItems.length} danger={lowStockItems.length > 0} />
            <NumRow label="Ушло в минус" value={negativeStockItems.length} danger={negativeStockItems.length > 0} />
            {negativeStockItems.length > 0 && (
              <p className="text-label text-danger mt-2">{negativeStockItems.map((i) => i.name).join(', ')}</p>
            )}
          </div>
        </div>

        {/* Блок 4 — прогноз */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
          <h2 className="text-label text-gray-500 uppercase tracking-wide font-semibold mb-3">Прогноз и масштабирование <span className="normal-case text-gray-400">(среднее за последние 3 закрытых месяца)</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3">
            <Metric label="Средняя выручка/мес" value={formatMoney(avgIncome)} />
            <Metric label="Средний расход/мес" value={formatMoney(avgExpense.plus(avgSalary))} />
            <Metric label="Средняя прибыль/мес" value={formatMoney(avgProfit)} danger={isNegativeMoney(avgProfit)} />
            <Metric label="Тренд прибыли" value={trendPct ? `${trendPct.gt(0) ? '↑' : '↓'} ${trendPct.abs().toFixed(0)}%` : '—'} danger={trendPct ? trendPct.isNegative() : false} />
            <Metric label="Прогноз на след. месяц" value={formatMoney(avgProfit)} danger={isNegativeMoney(avgProfit)} />
            <Metric label="Ожидаемые поступления" value={formatMoney(outstandingSum)} />
            <Metric label="Точка безубыточности/мес" value={formatMoney(breakEven)} />
          </div>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value, sub, danger }: { label: string; value: string; sub?: boolean; danger?: boolean }) {
  return (
    <div>
      <p className={`text-label text-gray-500 uppercase tracking-wide ${sub ? 'pl-2' : ''}`}>{label}</p>
      <p className={`text-body font-semibold tabular-nums ${sub ? 'pl-2 text-gray-700' : 'text-gray-900'} ${danger ? 'text-danger' : ''}`}>{value}</p>
    </div>
  )
}

function NumRow({ label, value, pct, danger }: { label: React.ReactNode; value: React.ReactNode; pct?: number | null; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-body">
      <span className="text-gray-700 truncate max-w-[65%]">{label}</span>
      <span className={`tabular-nums font-medium ${danger ? 'text-danger' : 'text-gray-900'}`}>
        {value}{pct != null ? <span className="text-gray-400 font-normal"> · {pct.toFixed(0)}%</span> : null}
      </span>
    </div>
  )
}
