import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { KpiCard, Card, SectionHeader, Badge, FUNNEL_TONE } from '@/components/crm/ui'
import { FUNNEL_STAGE_LABELS, formatMoney, isNegativeMoney } from '@/lib/crm/utils'
import { RevenueChart } from '@/components/crm/dashboard/RevenueChart'
import Decimal from 'decimal.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function endOfDay  (d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

const MONTH_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const FUNNEL_STAGES = [
  'NEW_LEAD','CONTACT_MADE','QUOTE_SENT','WORK_SCHEDULED','WORK_DONE','INVOICE_SENT','PAID',
] as const

const ACTIVITY_COLORS: Record<string, string> = {
  PAID:         'bg-success',
  INVOICE_SENT: 'bg-warning',
  WORK_DONE:    'bg-info',
  NEW_LEAD:     'bg-gray-200',
  PROBLEM:      'bg-danger',
  DEFAULT:      'bg-gray-200',
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getCrmSession()
  if (!session) return null
  const companyId = session.user.companyId

  const now         = new Date()
  const todayStart  = startOfDay(now)
  const todayEnd    = endOfDay(now)
  const monthStart  = startOfMonth(now)

  // ── KPI queries ────────────────────────────────────────────────────────────
  const [
    [allFinances, reinvestments],
    monthFinances,
    invoiceAgg,
    overdueCount,
    tasksToday,
    totalClients,
    paidClients,
    companyInfo,
    stageCounts,
    recentAudit,
    chartFinances,
  ] = await Promise.all([
    // 1. Касса: INCOME/EXPENSE/SALARY из FinanceEntry + REINVESTMENT из CapitalEntry
    Promise.all([
      prisma.financeEntry.findMany({
        where:  { companyId, type: { in: ['INCOME','EXPENSE','SALARY'] } },
        select: { type: true, amount: true },
      }),
      prisma.capitalEntry.findMany({
        where:  { companyId, type: 'REINVESTMENT' },
        select: { amount: true },
      }),
    ]),
    // 2. P&L this month
    prisma.financeEntry.findMany({
      where:  { companyId, date: { gte: monthStart, lte: now }, type: { in: ['INCOME','EXPENSE','SALARY'] } },
      select: { type: true, amount: true },
    }),
    // 3. Accounts receivable
    prisma.invoice.aggregate({
      where: { companyId, status: { in: ['ISSUED','PARTIAL','OVERDUE'] } },
      _sum:  { total: true },
    }),
    // 4. Overdue count
    prisma.invoice.count({ where: { companyId, status: 'OVERDUE' } }),
    // 5. Tasks today
    prisma.task.count({
      where: { companyId, status: { not: 'DONE' }, scheduledAt: { gte: todayStart, lte: todayEnd } },
    }),
    // 6. Total active clients
    prisma.client.count({ where: { companyId, active: true } }),
    // 7. Paid clients (for conversion)
    prisma.client.count({ where: { companyId, funnelStage: 'PAID' } }),
    // 8. Company info (placeholder warning)
    prisma.companyInfo.findUnique({ where: { companyId } }),
    // 9. Pipeline by stage
    prisma.client.groupBy({ by: ['funnelStage'], where: { companyId, active: true }, _count: true }),
    // 10. Recent audit log
    prisma.auditLog.findMany({
      where:   { companyId },
      orderBy: { createdAt: 'desc' },
      take:    6,
      include: { user: { select: { name: true } } },
    }),
    // 11. Chart: last 6 months finances
    prisma.financeEntry.findMany({
      where: {
        companyId,
        type: { in: ['INCOME','EXPENSE','SALARY'] },
        date: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
      },
      select: { type: true, amount: true, date: true },
    }),
  ])

  // ── KPI computations ───────────────────────────────────────────────────────

  let cash = new Decimal(0)
  for (const f of allFinances) {
    const a = new Decimal(f.amount.toString())
    if (f.type === 'INCOME') cash = cash.plus(a)
    else                     cash = cash.minus(a)
  }
  for (const r of reinvestments) {
    cash = cash.plus(new Decimal(r.amount.toString()))
  }

  let plMonth = new Decimal(0)
  for (const f of monthFinances) {
    const a = new Decimal(f.amount.toString())
    if (f.type === 'INCOME') plMonth = plMonth.plus(a)
    else                     plMonth = plMonth.minus(a)
  }

  const receivable   = new Decimal((invoiceAgg._sum.total ?? 0).toString())
  const conversion   = totalClients > 0 ? Math.round((paidClients / totalClients) * 100) : 0
  const isPlaceholder = companyInfo?.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ'

  // ── Stage map ──────────────────────────────────────────────────────────────

  const stageMap: Record<string, number> = {}
  for (const s of stageCounts) stageMap[s.funnelStage] = s._count
  const totalInPipeline = Object.values(stageMap).reduce((a, b) => a + b, 0)

  // ── Chart data ─────────────────────────────────────────────────────────────

  const chartMap: Record<string, { income: number; expense: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    chartMap[`${d.getFullYear()}-${d.getMonth()}`] = { income: 0, expense: 0 }
  }
  for (const f of chartFinances) {
    const key = `${f.date.getFullYear()}-${f.date.getMonth()}`
    if (!chartMap[key]) continue
    const a = Number(f.amount)
    if (f.type === 'INCOME')              chartMap[key].income  += a
    else /* EXPENSE | SALARY */           chartMap[key].expense += a
  }
  const chartData = Object.entries(chartMap).map(([key, v]) => {
    const [y, m] = key.split('-').map(Number)
    return { month: MONTH_SHORT[m], ...v }
  })
  const chartMax = Math.max(...chartData.flatMap((d) => [d.income, d.expense]), 1)

  // ── Date header ────────────────────────────────────────────────────────────

  const dateLabel = now.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display font-bold text-gray-900">Dashboard</h1>
          <p className="text-body text-gray-500 mt-0.5 capitalize">{dateLabel}</p>
        </div>
      </div>

      {/* Placeholder warning */}
      {isPlaceholder && (
        <div className="bg-warning/10 border border-warning/30 rounded-card px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-warning font-semibold text-body">Реквизиты компании не заполнены</p>
            <p className="text-gray-500 text-label mt-0.5">Заполни NIF, адрес и IBAN перед первым счётом</p>
          </div>
          <Link href="/crm/settings" className="shrink-0 ml-4 bg-white border border-warning/40 text-warning text-body px-4 py-2 rounded-control hover:bg-warning/5 transition">
            Заполнить
          </Link>
        </div>
      )}

      {/* KPI row — 5 cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 lg:grid-cols-3 gap-4">
        <Link href="/crm/finance">
          <KpiCard
            label="Касса"
            value={<span className={isNegativeMoney(cash) ? 'text-danger' : ''}>{formatMoney(cash)}</span>}
            delta={cash.isZero() ? 'Нет данных' : undefined}
            deltaTone="neutral"
          />
        </Link>
        <Link href="/crm/finance">
          <KpiCard
            label="P&L за месяц"
            value={<span className={isNegativeMoney(plMonth) ? 'text-danger' : ''}>{formatMoney(plMonth)}</span>}
            delta={plMonth.isPositive() && !plMonth.isZero() ? 'Прибыльно' : plMonth.isNegative() ? 'Убыток' : 'Нет данных'}
            deltaTone={plMonth.isPositive() && !plMonth.isZero() ? 'success' : plMonth.isNegative() ? 'danger' : 'neutral'}
          />
        </Link>
        <Link href="/crm/funnel">
          <KpiCard
            label="Конверсия воронки"
            value={`${conversion}%`}
            delta="Лид → Оплачено"
            deltaTone="neutral"
          />
        </Link>
        <Link href="/crm/invoices">
          <KpiCard
            label="Дебиторка"
            value={<span className={receivable.isZero() ? '' : 'text-danger'}>{formatMoney(receivable)}</span>}
            delta={overdueCount > 0 ? `${overdueCount} просрочено` : 'Все в срок'}
            deltaTone={overdueCount > 0 ? 'danger' : 'success'}
          />
        </Link>
        <Link href="/crm/schedule">
          <KpiCard
            label="Задач сегодня"
            value={tasksToday}
            delta="В планировщике"
            deltaTone="neutral"
          />
        </Link>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Chart + Recent activity */}
        <div className="lg:col-span-2 space-y-6">

          {/* Revenue chart */}
          <Card padding={false}>
            <div className="px-5 pt-5 pb-2">
              <SectionHeader title="Доходы и расходы — последние 6 месяцев" />
              <RevenueChart data={chartData} maxVal={chartMax} />
            </div>
          </Card>

          {/* Recent activity */}
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-label text-gray-500 uppercase tracking-wide font-semibold">Последние действия</h3>
            </div>
            {recentAudit.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-gray-500 text-body">Активности пока нет</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentAudit.map((entry) => {
                  const dot = ACTIVITY_COLORS[entry.action] ?? ACTIVITY_COLORS.DEFAULT
                  const ts  = entry.createdAt.toLocaleTimeString('ru-RU', {
                    hour: '2-digit', minute: '2-digit',
                    ...(entry.createdAt < todayStart && { day: '2-digit', month: '2-digit' }),
                  })
                  return (
                    <div key={entry.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <p className="text-body text-gray-900 flex-1 truncate">
                        <span className="text-gray-500">{entry.entity}</span>
                        {' '}{entry.action}
                        {entry.user && <span className="text-gray-200"> · {entry.user.name}</span>}
                      </p>
                      <span className="text-label text-gray-500 tabular-nums shrink-0">{ts}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Pipeline by stage */}
        <div>
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-label text-gray-500 uppercase tracking-wide font-semibold">Воронка по стадиям</h3>
            </div>

            {/* Stacked bar */}
            {totalInPipeline > 0 && (
              <div className="px-5 py-3">
                <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
                  {FUNNEL_STAGES.map((stage) => {
                    const count = stageMap[stage] ?? 0
                    if (!count) return null
                    const pct = (count / totalInPipeline) * 100
                    const COLOR_MAP: Record<string, string> = {
                      NEW_LEAD:       'bg-gray-200',
                      CONTACT_MADE:   'bg-info',
                      QUOTE_SENT:     'bg-purple-400',
                      WORK_SCHEDULED: 'bg-warning',
                      WORK_DONE:      'bg-teal-400',
                      INVOICE_SENT:   'bg-warning/70',
                      PAID:           'bg-success',
                    }
                    return (
                      <div
                        key={stage}
                        className={`${COLOR_MAP[stage] ?? 'bg-gray-200'} rounded-full`}
                        style={{ width: `${pct}%` }}
                        title={`${FUNNEL_STAGE_LABELS[stage]}: ${count}`}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stage list */}
            <div className="divide-y divide-gray-100 pb-2">
              {FUNNEL_STAGES.map((stage) => {
                const count = stageMap[stage] ?? 0
                return (
                  <Link
                    key={stage}
                    href={`/crm/funnel`}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50/70 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={FUNNEL_TONE[stage] ?? 'neutral'} className="text-[10px]">
                        {FUNNEL_STAGE_LABELS[stage]}
                      </Badge>
                    </div>
                    <span className="text-body text-gray-900 font-medium tabular-nums">{count}</span>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}