import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { KpiCard, Card, SectionHeader, Badge, FUNNEL_TONE } from '@/components/crm/ui'
import { FUNNEL_STAGE_LABELS, formatMoney, isNegativeMoney } from '@/lib/crm/utils'
import { RevenueChart } from '@/components/crm/dashboard/RevenueChart'
import { computeCashSummary } from '@/lib/crm/services/cash'
import { outstandingBalances } from '@/lib/crm/services/ar'
import { hasPermission } from '@/lib/crm/permissions'
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

  // Дашборд агрегирует данные из нескольких модулей — каждый блок виден
  // только если у сотрудника есть право VIEW на соответствующий модуль,
  // иначе финансовые/клиентские данные утекали бы любому залогиненному
  // сотруднику мимо матрицы прав (реальный экран не хуже прямого запроса).
  const canFinance  = hasPermission(session.user.role, session.user.permissions, 'FINANCE',  'VIEW')
  const canInvoices = hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')
  const canClients  = hasPermission(session.user.role, session.user.permissions, 'CLIENTS',  'VIEW')
  const canSchedule = hasPermission(session.user.role, session.user.permissions, 'SCHEDULE', 'VIEW')
  const canSettings = hasPermission(session.user.role, session.user.permissions, 'SETTINGS', 'VIEW')

  const now         = new Date()
  const todayStart  = startOfDay(now)
  const todayEnd    = endOfDay(now)
  const monthStart  = startOfMonth(now)

  // ── KPI queries ────────────────────────────────────────────────────────────
  const [
    cashSummary,
    monthFinances,
    outstandingInvoices,
    overdueCount,
    tasksToday,
    totalClients,
    paidClients,
    companyInfo,
    stageCounts,
    recentAudit,
    chartFinances,
  ] = await Promise.all([
    // 1. Касса — единая формула, см. lib/crm/services/cash.ts
    canFinance ? computeCashSummary(companyId) : null,
    // 2. P&L this month
    canFinance ? prisma.financeEntry.findMany({
      where:  { companyId, date: { gte: monthStart, lte: now }, type: { in: ['INCOME','EXPENSE','SALARY'] } },
      select: { type: true, amount: true },
    }) : [],
    // 3. Accounts receivable
    canInvoices ? prisma.invoice.findMany({
      where:  { companyId, status: { in: ['ISSUED','PARTIAL','OVERDUE'] } },
      select: { id: true, total: true, ivaRate: true },
    }) : [],
    // 4. Overdue count
    canInvoices ? prisma.invoice.count({ where: { companyId, status: 'OVERDUE' } }) : 0,
    // 5. Tasks today
    canSchedule ? prisma.task.count({
      where: { companyId, status: { not: 'DONE' }, scheduledAt: { gte: todayStart, lte: todayEnd } },
    }) : 0,
    // 6. Total active clients
    canClients ? prisma.client.count({ where: { companyId, active: true } }) : 0,
    // 7. Paid clients (for conversion)
    canClients ? prisma.client.count({ where: { companyId, funnelStage: 'PAID' } }) : 0,
    // 8. Company info (placeholder warning)
    canSettings ? prisma.companyInfo.findUnique({ where: { companyId } }) : null,
    // 9. Pipeline by stage
    canClients ? prisma.client.groupBy({ by: ['funnelStage'], where: { companyId, active: true }, _count: true }) : [],
    // 10. Recent audit log — как минимум SETTINGS, чтобы не светить чужую активность
    canSettings ? prisma.auditLog.findMany({
      where:   { companyId },
      orderBy: { createdAt: 'desc' },
      take:    6,
      include: { user: { select: { name: true } } },
    }) : [],
    // 11. Chart: last 6 months finances
    canFinance ? prisma.financeEntry.findMany({
      where: {
        companyId,
        type: { in: ['INCOME','EXPENSE','SALARY'] },
        date: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
      },
      select: { type: true, amount: true, date: true },
    }) : [],
  ])

  // ── KPI computations ───────────────────────────────────────────────────────

  const cash = cashSummary?.cash ?? new Decimal(0)

  let plMonth = new Decimal(0)
  for (const f of monthFinances) {
    const a = new Decimal(f.amount.toString())
    if (f.type === 'INCOME') plMonth = plMonth.plus(a)
    else                     plMonth = plMonth.minus(a)
  }

  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const balances = await outstandingBalances(outstandingInvoices)
  const receivable = outstandingInvoices.reduce(
    (s, i) => s.plus(balances.get(i.id)!),
    new Decimal(0),
  )
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
        <KpiLink href="/crm/finance" enabled={canFinance}>
          <KpiCard
            label="Касса"
            value={canFinance ? <span className={isNegativeMoney(cash) ? 'text-danger' : ''}>{formatMoney(cash)}</span> : '—'}
            delta={!canFinance ? 'Нет доступа' : cash.isZero() ? 'Нет данных' : cashSummary!.personalInProject.gt(0) ? `Личные: ${formatMoney(cashSummary!.personalInProject)}` : undefined}
            deltaTone={!canFinance ? 'neutral' : cashSummary!.personalInProject.gt(0) ? 'danger' : 'neutral'}
          />
        </KpiLink>
        <KpiLink href="/crm/finance" enabled={canFinance}>
          <KpiCard
            label="P&L за месяц"
            value={canFinance ? <span className={isNegativeMoney(plMonth) ? 'text-danger' : ''}>{formatMoney(plMonth)}</span> : '—'}
            delta={!canFinance ? 'Нет доступа' : plMonth.isPositive() && !plMonth.isZero() ? 'Прибыльно' : plMonth.isNegative() ? 'Убыток' : 'Нет данных'}
            deltaTone={!canFinance ? 'neutral' : plMonth.isPositive() && !plMonth.isZero() ? 'success' : plMonth.isNegative() ? 'danger' : 'neutral'}
          />
        </KpiLink>
        <KpiLink href="/crm/funnel" enabled={canClients}>
          <KpiCard
            label="Конверсия воронки"
            value={canClients ? `${conversion}%` : '—'}
            delta={canClients ? 'Лид → Оплачено' : 'Нет доступа'}
            deltaTone="neutral"
          />
        </KpiLink>
        <KpiLink href="/crm/invoices" enabled={canInvoices}>
          <KpiCard
            label="Дебиторка"
            value={canInvoices ? <span className={receivable.isZero() ? '' : 'text-danger'}>{formatMoney(receivable)}</span> : '—'}
            delta={!canInvoices ? 'Нет доступа' : overdueCount > 0 ? `${overdueCount} просрочено` : 'Все в срок'}
            deltaTone={!canInvoices ? 'neutral' : overdueCount > 0 ? 'danger' : 'success'}
          />
        </KpiLink>
        <KpiLink href="/crm/schedule" enabled={canSchedule}>
          <KpiCard
            label="Задач сегодня"
            value={canSchedule ? tasksToday : '—'}
            delta={canSchedule ? 'В планировщике' : 'Нет доступа'}
            deltaTone="neutral"
          />
        </KpiLink>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Chart + Recent activity */}
        <div className="lg:col-span-2 space-y-6">

          {/* Revenue chart */}
          <Card padding={false}>
            <div className="px-5 pt-5 pb-2">
              <SectionHeader title="Доходы и расходы — последние 6 месяцев" />
              {canFinance ? (
                <RevenueChart data={chartData} maxVal={chartMax} />
              ) : (
                <p className="text-gray-500 text-body text-center py-8">Нет доступа к финансам</p>
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-label text-gray-500 uppercase tracking-wide font-semibold">Последние действия</h3>
            </div>
            {!canSettings ? (
              <div className="px-5 py-8 text-center">
                <p className="text-gray-500 text-body">Нет доступа</p>
              </div>
            ) : recentAudit.length === 0 ? (
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
                        {entry.user && <span className="text-gray-500"> · {entry.user.name}</span>}
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

            {!canClients ? (
              <div className="px-5 py-8 text-center">
                <p className="text-gray-500 text-body">Нет доступа</p>
              </div>
            ) : (
              <>
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
                      <Badge tone={FUNNEL_TONE[stage] ?? 'neutral'}>
                        {FUNNEL_STAGE_LABELS[stage]}
                      </Badge>
                    </div>
                    <span className="text-body text-gray-900 font-medium tabular-nums">{count}</span>
                  </Link>
                )
              })}
            </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}

function KpiLink({ href, enabled, children }: { href: string; enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return <div className="cursor-default opacity-60">{children}</div>
  return <Link href={href}>{children}</Link>
}