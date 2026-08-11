import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { DocumentBuilder, type BuilderInitialData } from '@/components/crm/invoices/DocumentBuilder'

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const quote = await prisma.quote.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      invoices: { select: { id: true, number: true } },
    },
  })
  if (!quote) notFound()

  const [clients, companyInfo, inventoryItems] = await Promise.all([
    prisma.client.findMany({
      where:   { companyId: session.user.companyId, active: true },
      select:  {
        id: true, firstName: true, lastName: true, phone: true, marina: true, language: true,
        yachts: { where: { archived: false }, select: { id: true, name: true, model: true }, orderBy: { createdAt: 'asc' } },
      },
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
    clientId:   quote.clientId,
    boatId:     quote.boatId,
    language:   quote.language,
    ivaRate:    quote.ivaRate.toString(),
    validUntil: toDateInput(quote.validUntil),
    notes:      quote.notes,
    jobs: quote.jobs.map((j) => ({
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

  const linkedInvoiceHint = quote.invoices.length > 0
    ? `По этой смете уже есть счёт ${quote.invoices.map((i) => i.number).join(', ')} — он не изменится автоматически.`
    : null

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href={`/crm/invoices/quote/${id}`} className="text-gray-200 hover:text-gray-500 text-body transition">← Пресмет</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-heading font-bold text-gray-900">Редактирование пресмета</h1>
      </div>

      <div className="flex-1 p-6">
        <DocumentBuilder
          kind="quote"
          mode="edit"
          documentId={quote.id}
          initialData={initialData}
          linkedInvoiceHint={linkedInvoiceHint}
          clients={clients.map((c) => ({ ...c, boats: c.yachts.map((y) => ({ id: y.id, name: y.name, model: y.model })) }))}
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
