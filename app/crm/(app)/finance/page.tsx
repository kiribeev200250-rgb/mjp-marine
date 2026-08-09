import { redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { formatMoney } from '@/lib/crm/utils'
import { KpiCard, ExportCsvButton } from '@/components/crm/ui'
import { TransactionForm } from '@/components/crm/finance/TransactionForm'
import { DeleteEntryButton } from '@/components/crm/finance/DeleteEntryButton'
import Decimal from 'decimal.js'

interface SearchParams { month?: string }

const TYPE_RU: Record<string, string> = {
  INCOME:  'Доход',
  EXPENSE: 'Расход',
  SALARY:  'Зарплата',
}
const TYPE_COLOR: Record<string, string> = {
  INCOME:  'text-success',
  EXPENSE: 'text-danger',
  SALARY:  'text-warning',
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(d)
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(Number(y), Number(m) - 1, 1))
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  // Determine month window
  const now       = new Date()
  const ymDefault = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ym        = sp.month ?? ymDefault
  const [y, m]    = ym.split('-').map(Number)
  const from      = new Date(y, m - 1, 1)
  const to        = new Date(y, m,     1)     // exclusive

  // Prev / next months for nav
  const prevDate = new Date(y, m - 2, 1)
  const nextDate = new Date(y, m,     1)
  const prev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  const [monthEntries, allEntries, capitalEntries] = await Promise.all([
    // Current month finance entries
    prisma.financeEntry.findMany({
      where:   { companyId: session.user.companyId, date: { gte: from, lt: to } },
      orderBy: { date: 'desc' },
    }),
    // Last 30 recent (for list)
    prisma.financeEntry.findMany({
      where:   { companyId: session.user.companyId },
      orderBy: { date: 'desc' },
      take:    30,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
    // All capital entries for cash-on-hand
    prisma.capitalEntry.findMany({
      where: { companyId: session.user.companyId, type: 'REINVESTMENT' },
    }),
  ])

  // KPI calculations
  const income  = monthEntries.filter((e) => e.type === 'INCOME') .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const expense = monthEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const salary  = monthEntries.filter((e) => e.type === 'SALARY') .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const pl      = income.minus(expense).minus(salary)

  // Cash on hand = all-time income+reinvestment − expense − salary
  const allIncome   = allEntries.filter((e) => e.type === 'INCOME') .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const allExpense  = allEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const allSalary   = allEntries.filter((e) => e.type === 'SALARY') .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const reinvest    = capitalEntries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const cash        = allIncome.plus(reinvest).minus(allExpense).minus(allSalary)

  // Expenses by category for this month
  const expenseEntries = monthEntries.filter((e) => e.type === 'EXPENSE' || e.type === 'SALARY')
  const catMap = new Map<string, Decimal>()
  expenseEntries.forEach((e) => {
    const cat = e.category || '—'
    catMap.set(cat, (catMap.get(cat) ?? new Decimal(0)).plus(e.amount.toString()))
  })
  const totalExpenses = expense.plus(salary)
  const categories = [...catMap.entries()]
    .sort((a, b) => b[1].comparedTo(a[1]))
    .slice(0, 8)
    .map(([name, amt]) => ({
      name,
      amount: amt,
      pct: totalExpenses.gt(0) ? amt.div(totalExpenses).times(100).toNumber() : 0,
    }))

  // Month delta labels for KpiCards
  const plDelta = pl.gte(0)
    ? `+${formatMoney(pl)}`
    : formatMoney(pl)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-heading font-bold text-gray-900">Финансы</h1>
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <a href={`?month=${prev}`} className="px-2.5 py-1 rounded-control border border-gray-200 text-label text-gray-500 hover:bg-gray-50 transition">‹</a>
          <span className="text-body font-semibold text-gray-900 min-w-[140px] text-center capitalize">{monthLabel(ym)}</span>
          <a href={`?month=${next}`} className={`px-2.5 py-1 rounded-control border border-gray-200 text-label text-gray-500 hover:bg-gray-50 transition ${ym >= ymDefault ? 'opacity-30 pointer-events-none' : ''}`}>›</a>
        </div>
      </div>

      {/* KPI row */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 grid grid-cols-4 gap-4">
        <KpiCard label="Доход за месяц"   value={formatMoney(income)}  deltaTone="success" />
        <KpiCard label="Расход + зарплата" value={formatMoney(expense.plus(salary))} deltaTone={expense.plus(salary).gt(0) ? 'danger' : 'neutral'} />
        <KpiCard label="Касса (всего)"    value={formatMoney(cash)}    deltaTone={cash.gte(0) ? 'success' : 'danger'} />
        <KpiCard
          label="P&L за месяц"
          value={formatMoney(pl)}
          delta={plDelta}
          deltaTone={pl.gte(0) ? 'success' : 'danger'}
        />
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 p-6 grid grid-cols-[280px_1fr_1.4fr] gap-5 overflow-auto items-start">

        {/* Left: add transaction form */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
          <h2 className="text-subheading font-bold text-gray-900 mb-4">Записать транзакцию</h2>
          <TransactionForm />
        </div>

        {/* Center: expenses by category */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5">
          <h2 className="text-subheading font-bold text-gray-900 mb-1">Расходы по категориям</h2>
          <p className="text-label text-gray-500 mb-4">Расходы + зарплата за {monthLabel(ym)}</p>
          {categories.length === 0 ? (
            <p className="text-body text-gray-300 text-center py-8">Расходов нет</p>
          ) : (
            <div className="space-y-3">
              {categories.map(({ name, amount: amt, pct }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-body text-gray-700 truncate max-w-[55%]">{name}</span>
                    <span className="text-body text-gray-900 tabular-nums font-medium">{formatMoney(amt)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-danger rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-300 mt-0.5">{pct.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: recent transactions */}
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-subheading font-bold text-gray-900">Последние транзакции</h2>
            <div className="flex items-center gap-3">
              <span className="text-label text-gray-500">{allEntries.length} записей</span>
              <ExportCsvButton
                filename={`finance-${ym}`}
                headers={['ID', 'Тип', 'Дата', 'Категория', 'Сумма', 'Способ оплаты', 'Клиент', 'Описание']}
                rows={allEntries.map((r) => [
                  r.autoId, TYPE_RU[r.type] ?? r.type, fmtDate(r.date), r.category, Number(r.amount),
                  r.paymentMethod, r.client ? `${r.client.firstName} ${r.client.lastName}` : '', r.description,
                ])}
              />
            </div>
          </div>
          {allEntries.length === 0 ? (
            <p className="text-body text-gray-300 text-center py-10">Записей нет</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {allEntries.map((e) => {
                const amtDec = new Decimal(e.amount.toString())
                const isNeg  = e.type !== 'INCOME'
                return (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors group">
                    {/* Type dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      e.type === 'INCOME'  ? 'bg-success' :
                      e.type === 'EXPENSE' ? 'bg-danger'  : 'bg-warning'
                    }`} />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium text-gray-900 truncate">{e.category}</p>
                      <p className="text-label text-gray-500">
                        {fmtDate(e.date)} · {TYPE_RU[e.type]}
                        {e.client ? ` · ${e.client.firstName} ${e.client.lastName}` : ''}
                      </p>
                    </div>
                    {/* Amount */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-body font-semibold tabular-nums ${isNeg ? 'text-danger' : 'text-success'}`}>
                        {isNeg ? '−' : '+'}{formatMoney(amtDec)}
                      </span>
                      <span className="text-label text-gray-500 font-mono">{e.autoId}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DeleteEntryButton id={e.id} />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}