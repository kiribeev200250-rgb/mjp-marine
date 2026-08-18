import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, PROJECT_STATUS_LABELS } from '@/lib/crm/utils'
import { Badge, PROJECT_TONE } from '@/components/crm/ui'
import { AddWorkForm } from '@/components/crm/projects/AddWorkForm'
import { ProjectWorksList, type WorkRow } from '@/components/crm/projects/ProjectWorksList'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return null
  requirePermission(session.user.role, session.user.permissions, 'PROJECTS', 'VIEW')

  const project = await prisma.project.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      boat: { include: { client: { select: { id: true, firstName: true, lastName: true, language: true } } } },
      works: {
        orderBy: { sortOrder: 'asc' },
        include: {
          materials: true,
          task: { select: { id: true } },
          invoice: { select: { id: true, number: true } },
          quote: { select: { id: true, number: true } },
        },
      },
    },
  })
  if (!project) notFound()

  const companyInfo = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })

  const works: WorkRow[] = project.works.map((w) => ({
    id: w.id,
    title: w.title,
    laborCost: w.laborCost.toString(),
    materialsTotal: w.materials.reduce((s, m) => s + Number(m.total), 0).toString(),
    status: w.status,
    scheduledAt: w.scheduledAt ? w.scheduledAt.toISOString() : null,
    taskId: w.taskId,
    invoiceId: w.invoiceId,
    invoiceNumber: w.invoice?.number ?? null,
    quoteId: w.quoteId,
    quoteNumber: w.quote?.number ?? null,
    materials: w.materials.map((m) => ({
      id: m.id, name: m.name, quantity: m.quantity.toString(), unitPrice: m.unitPrice.toString(), total: m.total.toString(),
    })),
  }))

  const planTotal = works
    .filter((w) => w.status !== 'MOVED_TO_INVOICE')
    .reduce((s, w) => s + Number(w.laborCost) + Number(w.materialsTotal), 0)

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href={`/crm/clients/${project.boat.clientId}/boats/${project.boatId}`} className="text-gray-500 hover:text-gray-900 text-body transition">
          ← ⛵ {project.boat.name || project.boat.model || 'Лодка'}
        </Link>
        <span className="text-gray-500">/</span>
        <h1 className="text-heading font-bold text-gray-900">📁 {project.name}</h1>
        <Badge tone={PROJECT_TONE[project.status] ?? 'neutral'}>{PROJECT_STATUS_LABELS[project.status] ?? project.status}</Badge>
        <span className="ml-auto text-label text-gray-500">
          Пайплайн работ (план): <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(planTotal)}</span>
        </span>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
            <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-2">Проект</h2>
            <p className="text-body text-gray-900">Лодка: <Link href={`/crm/clients/${project.boat.clientId}/boats/${project.boatId}`} className="text-info hover:underline">{project.boat.name || project.boat.model}</Link></p>
            <p className="text-body text-gray-900">Клиент: <Link href={`/crm/clients/${project.boat.clientId}`} className="text-info hover:underline">{project.boat.client.firstName} {project.boat.client.lastName}</Link></p>
            {project.notes && <p className="text-body text-gray-500 mt-2">{project.notes}</p>}
          </div>

          <AddWorkForm projectId={project.id} />
        </div>

        <div className="lg:col-span-2">
          <ProjectWorksList
            projectId={project.id}
            works={works}
            defaultIvaRate={(companyInfo?.ivaRate ?? 21).toString()}
            defaultIrpfRate={(companyInfo?.irpfRate ?? 0).toString()}
            defaultLanguage={project.boat.client.language || 'ru'}
          />
        </div>
      </div>
    </main>
  )
}
