import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { DocumentBuilder, type BuilderInitialData } from '@/components/crm/invoices/DocumentBuilder'

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const invoice = await prisma.invoice.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: { jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } } },
  })
  if (!invoice) notFound()
  if (invoice.status !== 'DRAFT') redirect(`/crm/invoices/${id}`)

  const [clients, companyInfo, inventoryItems] = await Promise.all([
    prisma.client.findMany({
      where:   { companyId: session.user.companyId, active: true },
      select:  { id: true, firstName: true, lastName: true, phone: true, marina: true, language: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } }),
    prisma.inventoryItem.findMany({
      where:   { companyId: session.user.companyId, active: true },
      select:  { id: true, name: true, unit: true, sellPrice: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const initialData: BuilderInitialData = {
    clientId:      invoice.clientId,
    language:      invoice.language,
    ivaRate:       invoice.ivaRate.toString(),
    irpfRate:      invoice.irpfRate.toString(),
    dueDate:       toDateInput(invoice.dueDate),
    paymentMethod: invoice.paymentMethod,
    notes:         invoice.notes,
    jobs: invoice.jobs.map((j) => ({
      title:      j.title,
      laborHours: j.laborHours?.toString() ?? null,
      laborRate:  j.laborRate?.toString() ?? null,
      quantity:   j.quantity?.toString() ?? null,
      unitPrice:  j.unitPrice?.toString() ?? null,
      laborCost:  j.laborCost.toString(),
      materials: j.materials.map((m) => ({
        name:            m.name,
        quantity:        m.quantity.toString(),
        unitPrice:       m.unitPrice.toString(),
        inventoryItemId: m.inventoryItemId,
      })),
    })),
  }

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href={`/crm/invoices/${id}`} className="text-gray-200 hover:text-gray-500 text-body transition">← Счёт</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-heading font-bold text-gray-900">Редактирование черновика</h1>
      </div>

      <div className="flex-1 p-6">
        <DocumentBuilder
          kind="invoice"
          mode="edit"
          documentId={invoice.id}
          initialData={initialData}
          clients={clients}
          inventoryItems={inventoryItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit, sellPrice: i.sellPrice.toString() }))}
          defaultIvaRate={String(companyInfo?.ivaRate ?? 21)}
          defaultIrpfRate={String(companyInfo?.irpfRate ?? 0)}
          companyName={companyInfo?.legalName ?? 'MJP Marine Service'}
          companyLocation={[companyInfo?.city, companyInfo?.country].filter(Boolean).join(', ') || 'Costa Blanca, Spain'}
          companyLogoUrl={companyInfo?.logoUrl}
        />
      </div>
    </main>
  )
}
