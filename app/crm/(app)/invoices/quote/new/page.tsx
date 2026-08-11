import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { DocumentBuilder } from '@/components/crm/invoices/DocumentBuilder'

interface SearchParams { clientId?: string; boatId?: string }

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')

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

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href="/crm/invoices" className="text-gray-200 hover:text-gray-500 text-body transition">← Счета</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-heading font-bold text-gray-900">Новый пресмет</h1>
      </div>

      <div className="flex-1 p-6">
        <DocumentBuilder
          kind="quote"
          clients={clients.map((c) => ({ ...c, boats: c.yachts.map((y) => ({ id: y.id, name: y.name, model: y.model })) }))}
          inventoryItems={inventoryItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit, sellPrice: i.sellPrice.toString() }))}
          defaultIvaRate={String(companyInfo?.ivaRate ?? 21)}
          defaultIrpfRate={String(companyInfo?.irpfRate ?? 0)}
          companyName={companyInfo?.legalName ?? 'MJP Marine Service'}
          companyLocation={[companyInfo?.city, companyInfo?.country].filter(Boolean).join(', ') || 'Costa Blanca, Spain'}
          companyLogoUrl={companyInfo?.logoUrl}
          initialClientId={sp.clientId}
          initialBoatId={sp.boatId}
        />
      </div>
    </main>
  )
}