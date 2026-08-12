import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { KanbanBoard } from '@/components/crm/funnel/KanbanBoard'
import type { FunnelClient } from '@/components/crm/funnel/KanbanCard'
import { outstandingBalances } from '@/lib/crm/services/ar'

export default async function FunnelPage() {
  const session = await getCrmSession()
  if (!session) return null

  const clients = await prisma.client.findMany({
    where:   { companyId: session.user.companyId, active: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id:          true,
      firstName:   true,
      lastName:    true,
      marina:      true,
      source:      true,
      funnelStage: true,
      updatedAt:   true,
      phone:       true,
      language:    true,
      _count:   { select: { invoices: true, tasks: true } },
      invoices: {
        where:  { status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
        select: { id: true, total: true, ivaRate: true },
      },
      tasks: {
        orderBy: { createdAt: 'desc' },
        take:    1,
        select:  { title: true },
      },
    },
  })

  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const allInvoices = clients.flatMap((c) => c.invoices)
  const balances = await outstandingBalances(allInvoices)

  const serialized: FunnelClient[] = clients.map((c) => ({
    ...c,
    updatedAt:  c.updatedAt.toISOString(),
    invoices:   c.invoices.map((inv) => ({ total: balances.get(inv.id)!.toString() })),
    latestTask: c.tasks[0] ?? null,
  }))

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-heading font-bold text-gray-900">Воронка продаж</h1>
          <p className="text-label text-gray-500 mt-0.5">{clients.length} клиентов</p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <KanbanBoard initialClients={serialized} />
      </div>
    </main>
  )
}
