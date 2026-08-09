import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { TaskForm } from '@/components/crm/schedule/TaskForm'
import { QuickStatusPanel } from '@/components/crm/schedule/QuickStatusPanel'
import { MaterialsSection, type TaskMaterial } from '@/components/crm/schedule/MaterialsSection'
import { PhotosSection } from '@/components/crm/schedule/PhotosSection'
import { Badge, TASK_TONE } from '@/components/crm/ui'
import type { SerializedTask } from '@/components/crm/schedule/types'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return null

  const [task, clients, inventoryItems] = await Promise.all([
    prisma.task.findFirst({
      where:   { id, companyId: session.user.companyId },
      include: { client: { select: { id: true, firstName: true, lastName: true, marina: true } } },
    }),
    prisma.client.findMany({
      where:   { companyId: session.user.companyId, active: true },
      select:  { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.inventoryItem.findMany({
      where:   { companyId: session.user.companyId, active: true },
      select:  { id: true, name: true, unit: true, qtyInStock: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!task) notFound()

  const inventoryOptions = inventoryItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit, qtyInStock: i.qtyInStock.toString() }))
  const plannedMaterials = Array.isArray(task.plannedMaterials) ? (task.plannedMaterials as unknown as TaskMaterial[]) : []

  const serialized: SerializedTask = {
    id:          task.id,
    title:       task.title,
    description: task.description,
    status:      task.status,
    scheduledAt: task.scheduledAt?.toISOString() ?? null,
    startTime:   task.startTime?.toISOString()   ?? null,
    endTime:     task.endTime?.toISOString()     ?? null,
    isBacklog:   task.isBacklog,
    marina:      task.marina,
    clientId:    task.clientId,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt:   task.createdAt.toISOString(),
    client:      task.client,
  }

  const scheduledDate = task.scheduledAt
    ? task.scheduledAt.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href="/crm/schedule" className="text-gray-200 hover:text-gray-500 text-body transition">← Планировщик</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-heading font-bold text-gray-900 truncate">{task.title}</h1>
        <Badge tone={TASK_TONE[task.status] ?? 'neutral'}>{task.status}</Badge>
      </div>

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TaskForm task={serialized} clients={clients} />
            <MaterialsSection
              taskId={task.id}
              materials={plannedMaterials}
              writtenOff={task.materialsWrittenOff}
              items={inventoryOptions}
            />
            <PhotosSection taskId={task.id} photosBefore={task.photosBefore} photosAfter={task.photosAfter} />
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5 space-y-3">
              <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide">Детали</h2>
              {scheduledDate && <InfoRow label="Дата"    value={scheduledDate} />}
              {task.marina   && <InfoRow label="Марина"  value={task.marina} />}
              {task.client   && (
                <InfoRow label="Клиент" value={
                  <Link href={`/crm/clients/${task.clientId}`} className="text-gold hover:underline">
                    {task.client.firstName} {task.client.lastName}
                  </Link>
                } />
              )}
              <InfoRow label="Создана" value={new Date(task.createdAt).toLocaleDateString('ru-RU')} />
            </div>
            <QuickStatusPanel taskId={task.id} current={task.status} />
          </div>
        </div>
      </div>
    </main>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 text-label w-16 shrink-0">{label}</span>
      <span className="text-gray-900 text-body">{value}</span>
    </div>
  )
}