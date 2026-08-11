import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { TaskForm } from '@/components/crm/schedule/TaskForm'
import type { ClientWithBoats } from '@/components/crm/schedule/types'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; clientId?: string; boatId?: string }>
}) {
  const { date, clientId, boatId } = await searchParams
  const session = await getCrmSession()
  if (!session) return null

  const clientRows = await prisma.client.findMany({
    where:   { companyId: session.user.companyId, active: true },
    select:  {
      id: true, firstName: true, lastName: true,
      yachts: { where: { archived: false }, select: { id: true, name: true, model: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { firstName: 'asc' },
  })

  const clients: ClientWithBoats[] = clientRows.map((c) => ({
    id: c.id, firstName: c.firstName, lastName: c.lastName, boats: c.yachts,
  }))

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-heading font-bold text-gray-900">Новая задача</h1>
      </div>
      <div className="flex-1 p-6">
        <TaskForm clients={clients} defaultDate={date} defaultClientId={clientId} defaultBoatId={boatId} />
      </div>
    </main>
  )
}
