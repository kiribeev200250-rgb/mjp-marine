import { redirect } from 'next/navigation'
import Link from 'next/link'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission, hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, INVOICE_STATUS_LABELS } from '@/lib/crm/utils'
import { Card, KpiCard, SectionHeader, Badge, INVOICE_TONE, ExportCsvButton } from '@/components/crm/ui'
import { KpiGoalCard } from '@/components/crm/reports/KpiGoalCard'
import { BarList } from '@/components/crm/reports/BarList'
import { MarginTable } from '@/components/crm/reports/MarginTable'
import { marginByBoat, marginByClient, marginByWorkType } from '@/lib/crm/services/profitability'
import { outstandingBalances } from '@/lib/crm/services/ar'
import { computeWarrantyStats } from '@/lib/crm/services/warranty'
import { computeAccountsPayable } from '@/lib/crm/services/supplierBills'
import type { InvoiceStatus } from '@prisma/client'

interface SearchParams { month?: string }

const AD_CATEGORIES = ['Реклама — Facebook', 'Реклама — Google', 'Реклама — TikTok', 'Реклама — другое']

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(Number(y), Number(m) - 1, 1))
}

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'REPORTS', 'VIEW')
  const canEditGoal = hasPermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')

  const companyId = session.user.companyId

  const now       = new Date()
  const ymDefault = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ym        = sp.month ?? ymDefault
  const [y, m]    = ym.split('-').map(Number)
  const from      = new Date(y, m - 1, 1)
  const to        = new Date(y, m, 1) // exclusive

  const prevDate = new Date(y, m - 2, 1)
  const nextDate = new Date(y, m, 1)
  const prev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  const [
    paidInvoices,
    incomeByCategory,
    adSpend,
    newLeads,
    invoiceAgg,
    doneTasks,
    topClientAgg,
    outstandingInvoices,
    kpiGoal,
    plMonthEntries,
    marginBoats,
    marginClients,
    marginWorkTypes,
    warrantyStats,
    accountsPayable,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where:   { companyId, status: 'PAID', paidAt: { gte: from, lt: to } },
      include: { client: { select: { marina: true } } },
    }),
    prisma.financeEntry.groupBy({
      by: ['category'], where: { companyId, type: 'INCOME', date: { gte: from, lt: to } }, _sum: { amount: true },
    }),
    prisma.financeEntry.groupBy({
      by: ['category'],
      where: { companyId, type: 'EXPENSE', category: { in: AD_CATEGORIES }, date: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.client.count({ where: { companyId, createdAt: { gte: from, lt: to } } }),
    prisma.invoice.aggregate({
      where: { companyId, status: 'PAID', paidAt: { gte: from, lt: to } },
      _avg: { total: true }, _count: true, _sum: { total: true },
    }),
    prisma.task.count({ where: { companyId, status: 'DONE', completedAt: { gte: from, lt: to } } }),
    prisma.invoice.groupBy({
      by: ['clientId'], where: { companyId, status: 'PAID', paidAt: { gte: from, lt: to } },
      _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 5,
    }),
    prisma.invoice.findMany({
      where:   { companyId, status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.kpiGoal.findUnique({ where: { companyId_year_month: { companyId, year: y, month: m } } }),
    prisma.financeEntry.findMany({
      where: { companyId, date: { gte: from, lt: to }, type: { in: ['INCOME', 'EXPENSE', 'SALARY'] } },
      select: { type: true, amount: true },
    }),
    marginByBoat(companyId, from, to),
    marginByClient(companyId, from, to),
    marginByWorkType(companyId, from, to),
    computeWarrantyStats(companyId, from, to),
    computeAccountsPayable(companyId),
  ])

  // ── Выручка по маринам ──────────────────────────────────────────────────
  const marinaMap = new Map<string, number>()
  for (const inv of paidInvoices) {
    const marina = inv.client.marina || 'Без марины'
    marinaMap.set(marina, (marinaMap.get(marina) ?? 0) + Number(inv.total))
  }
  const revenueByMarina = [...marinaMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount }))

  // ── Выручка по видам работ (категории дохода) ───────────────────────────
  const revenueByCategory = incomeByCategory
    .map((c) => ({ label: c.category, amount: Number(c._sum.amount ?? 0) }))
    .sort((a, b) => b.amount - a.amount)

  // ── Реклама по каналам ───────────────────────────────────────────────────
  const adByChannel = adSpend
    .map((c) => ({ label: c.category.replace('Реклама — ', ''), amount: Number(c._sum.amount ?? 0) }))
    .sort((a, b) => b.amount - a.amount)
  const totalAdSpend = adByChannel.reduce((s, c) => s.plus(c.amount), new Decimal(0))
  const totalRevenue = revenueByCategory.reduce((s, c) => s.plus(c.amount), new Decimal(0))
  const blendedCpl  = newLeads > 0 ? totalAdSpend.div(newLeads) : null
  const blendedRomi = totalAdSpend.gt(0) ? totalRevenue.minus(totalAdSpend).div(totalAdSpend).mul(100) : null

  // ── Топ-клиенты ──────────────────────────────────────────────────────────
  const topClients = await prisma.client.findMany({
    where:  { id: { in: topClientAgg.map((c) => c.clientId) } },
    select: { id: true, firstName: true, lastName: true },
  })
  const topClientsWithTotals = topClientAgg
    .map((agg) => ({
      client: topClients.find((c) => c.id === agg.clientId),
      total:  Number(agg._sum.total ?? 0),
    }))
    .filter((c) => c.client)

  // ── P&L факт за месяц (для KPI-цели по марже) ───────────────────────────
  let plMonth = new Decimal(0)
  for (const f of plMonthEntries) {
    const a = new Decimal(f.amount.toString())
    plMonth = f.type === 'INCOME' ? plMonth.plus(a) : plMonth.minus(a)
  }

  const avgTicket = new Decimal((invoiceAgg._avg.total ?? 0).toString())
  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const balances = await outstandingBalances(outstandingInvoices)
  const outstandingSum = outstandingInvoices.reduce(
    (s, i) => s.plus(balances.get(i.id)!),
    new Decimal(0),
  )

  const today = new Date()

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-heading font-bold text-gray-900">Аналитика</h1>
          <Link href="/crm/reports/pl" className="text-label text-gold hover:underline">P&L — финансовый центр →</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?month=${prev}`} className="px-2.5 py-1 rounded-control border border-gray-200 text-label text-gray-500 hover:bg-gray-50 transition">‹</Link>
          <span className="text-body font-semibold text-gray-900 min-w-[140px] text-center capitalize">{monthLabel(ym)}</span>
          <Link href={`?month=${next}`} className={`px-2.5 py-1 rounded-control border border-gray-200 text-label text-gray-500 hover:bg-gray-50 transition ${ym >= ymDefault ? 'opacity-30 pointer-events-none' : ''}`}>›</Link>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Средний чек" value={formatMoney(avgTicket)} delta={`${invoiceAgg._count} оплаченных счетов`} deltaTone="neutral" />
          <KpiCard label="Выполнено работ" value={doneTasks} delta="Задач завершено" deltaTone="neutral" />
          <KpiCard label="Новых лидов" value={newLeads} delta="За месяц" deltaTone="neutral" />
          <KpiCard
            label="ROMI (реклама)"
            value={blendedRomi ? `${blendedRomi.toFixed(0)}%` : '—'}
            delta={blendedCpl ? `CPL: ${formatMoney(blendedCpl)}` : 'Нет расходов на рекламу'}
            deltaTone={blendedRomi && blendedRomi.gte(0) ? 'success' : blendedRomi ? 'danger' : 'neutral'}
          />
          <KpiCard
            label="Кредиторка (поставщикам)"
            value={formatMoney(accountsPayable)}
            delta="Заказано/принято, не оплачено"
            deltaTone={accountsPayable.gt(0) ? 'danger' : 'neutral'}
          />
        </div>

        <KpiGoalCard
          year={y} month={m}
          planRevenue={(kpiGoal?.revenue ?? 0).toString()}
          planMargin={(kpiGoal?.margin ?? 0).toString()}
          factRevenue={totalRevenue.toString()}
          factMargin={plMonth.toString()}
          canEdit={canEditGoal}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <SectionHeader title="Выручка по маринам" />
            <BarList items={revenueByMarina} />
          </Card>
          <Card>
            <SectionHeader title="Выручка по видам работ" />
            <BarList items={revenueByCategory} barColor="bg-info" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeader title="Прибыльность по лодкам" />
            <MarginTable rows={marginBoats} labelHeader="Лодка" />
          </Card>
          <Card>
            <SectionHeader title="Прибыльность по клиентам" />
            <MarginTable rows={marginClients} labelHeader="Клиент" />
          </Card>
          <Card>
            <SectionHeader title="Прибыльность по видам работ" />
            <MarginTable rows={marginWorkTypes} labelHeader="Работа" />
          </Card>
          <p className="text-label text-gray-500">
            Выручка — нетто по счёту (без IVA), материалы — по текущей закупочной цене склада. Себестоимость труда не учтена — в системе нет ставки часа.
          </p>
        </div>

        <Card>
          <SectionHeader title="Гарантия / переделки" />
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Гарантийных задач" value={warrantyStats.taskCount} deltaTone="neutral" />
            <KpiCard label="Часов на гарантию" value={warrantyStats.taskHours.toFixed(1)} deltaTone="neutral" />
            <KpiCard label="Себестоимость материалов (задачи)" value={formatMoney(warrantyStats.taskMaterialCost)} deltaTone={warrantyStats.taskMaterialCost.gt(0) ? 'danger' : 'neutral'} />
            <KpiCard label="Себестоимость материалов (счета)" value={formatMoney(warrantyStats.invoiceMaterialCost)} deltaTone={warrantyStats.invoiceMaterialCost.gt(0) ? 'danger' : 'neutral'} />
          </div>
          <p className="text-label text-gray-500 mt-3">
            Метрика качества — реальная себестоимость гарантийных случаев за месяц, без нового дохода клиенту.
            Часы — прокси по времени задачи (начало/конец), не денежная сумма — в системе нет ставки часа техника.
          </p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <SectionHeader title="Расходы на рекламу по каналам" />
            <BarList items={adByChannel} barColor="bg-danger" emptyText="Расходов на рекламу нет" />
            <p className="text-label text-gray-500 mt-3 pt-3 border-t border-gray-100">
              CPL и ROMI считаются по всем лидам/доходу за месяц — точная привязка канал→лид доступна только для Facebook (поле источника клиента), для Google/TikTok — оценка по общим цифрам.
            </p>
          </Card>
          <Card>
            <SectionHeader title="Топ-клиенты за месяц" />
            {topClientsWithTotals.length === 0 ? (
              <p className="text-body text-gray-500 text-center py-6">Оплаченных счетов нет</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {topClientsWithTotals.map(({ client, total }) => (
                  <Link
                    key={client!.id}
                    href={`/crm/clients/${client!.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-gray-50/70 transition -mx-1 px-1 rounded"
                  >
                    <span className="text-body text-gray-900">{client!.firstName} {client!.lastName}</span>
                    <span className="text-body text-gray-900 font-medium tabular-nums">{formatMoney(total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card padding={false}>
          <div className="px-5 pt-5 flex items-center justify-between">
            <SectionHeader title={`Дебиторка — ${formatMoney(outstandingSum)}`} className="mb-0" />
            <ExportCsvButton
              filename={`debitorka-${ym}`}
              headers={['Номер', 'Клиент', 'Дата', 'Срок оплаты', 'Сумма', 'Статус']}
              rows={outstandingInvoices.map((r) => [
                r.number, r.clientName, fmtDate(r.date), fmtDate(r.dueDate),
                Number(balances.get(r.id)), INVOICE_STATUS_LABELS[r.status] ?? r.status,
              ])}
            />
          </div>
          {outstandingInvoices.length === 0 ? (
            <p className="text-body text-gray-500 text-center py-8">Неоплаченных счетов нет</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-200">
                    <th className="px-5 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold">Номер</th>
                    <th className="px-5 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold">Клиент</th>
                    <th className="px-5 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold">Срок оплаты</th>
                    <th className="px-5 py-2.5 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Сумма</th>
                    <th className="px-5 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.map((inv) => {
                    const isOverdue = inv.status === 'OVERDUE' || (inv.dueDate && inv.dueDate < today)
                    const remaining = balances.get(inv.id)!
                    return (
                      <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition">
                        <td className="px-5 py-2.5">
                          <Link href={`/crm/invoices/${inv.id}`} className="font-mono text-gray-900 hover:text-gold transition">{inv.number}</Link>
                        </td>
                        <td className="px-5 py-2.5">
                          <Link href={`/crm/clients/${inv.client.id}`} className="text-gray-900 hover:text-gold transition">{inv.clientName}</Link>
                        </td>
                        <td className={`px-5 py-2.5 tabular-nums ${isOverdue ? 'text-danger font-medium' : 'text-gray-900'}`}>{fmtDate(inv.dueDate)}</td>
                        <td className={`px-5 py-2.5 text-right tabular-nums font-medium ${isOverdue ? 'text-danger' : 'text-gray-900'}`}>{formatMoney(remaining)}</td>
                        <td className="px-5 py-2.5">
                          <Badge tone={INVOICE_TONE[inv.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
