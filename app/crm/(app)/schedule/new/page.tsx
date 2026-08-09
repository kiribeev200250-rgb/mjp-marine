import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { TaskForm } from '@/components/crm/schedule/TaskForm'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; clientId?: string }>
}) {
  const { date, clientId } = await searchParams
  const session = await getCrmSession()
  if (!session) return null

  const clients = await prisma.client.findMany({
    where:   { companyId: session.user.companyId, active: true },
    select:  { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  })

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-heading font-bold text-gray-900">Новая задача</h1>
      </div>
      <div className="flex-1 p-6">
        <TaskForm clients={clients} defaultDate={date} />
      </div>
    </main>
  )
}