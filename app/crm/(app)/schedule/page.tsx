import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { SchedulerBoard } from '@/components/crm/schedule/SchedulerBoard'
import type { SerializedTask } from '@/components/crm/schedule/types'

export default async function SchedulePage() {
  const session = await getCrmSession()
  if (!session) return null

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      companyId: session.user.companyId,
      OR: [
        { status: { notIn: ['DONE'] } },
        { completedAt: { gte: fourteenDaysAgo } },
      ],
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      client: { select: { id: true, firstName: true, lastName: true, marina: true } },
    },
  })

  const serialized: SerializedTask[] = tasks.map((t) => ({
    id:          t.id,
    title:       t.title,
    description: t.description,
    status:      t.status,
    scheduledAt: t.scheduledAt?.toISOString() ?? null,
    startTime:   t.startTime?.toISOString()   ?? null,
    endTime:     t.endTime?.toISOString()     ?? null,
    isBacklog:   t.isBacklog,
    marina:      t.marina,
    clientId:    t.clientId,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt:   t.createdAt.toISOString(),
    client:      t.client,
  }))

  const todoCount = tasks.filter((t) => t.status !== 'DONE').length

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-heading font-bold text-gray-900">Планировщик</h1>
          <p className="text-label text-gray-500 mt-0.5">
            {todoCount > 0 ? `${todoCount} активных задач` : 'Все выполнено'}
          </p>
        </div>
        <Link
          href="/crm/schedule/new"
          className="bg-gold hover:bg-gold-light text-navy font-semibold text-body px-4 py-2 rounded-control transition"
        >
          + Новая задача
        </Link>
      </div>
      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        <SchedulerBoard initialTasks={serialized} />
      </div>
    </main>
  )
}