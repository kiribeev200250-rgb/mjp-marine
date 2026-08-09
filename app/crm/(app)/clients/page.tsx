import { Suspense } from 'react'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { ClientsTable } from '@/components/crm/clients/ClientsTable'
import { ClientFilters } from '@/components/crm/clients/ClientFilters'
import { ExportCsvButton } from '@/components/crm/ui'
import { FUNNEL_STAGE_LABELS } from '@/lib/crm/utils'
import type { ClientSource, FunnelStage } from '@prisma/client'

interface SearchParams {
  q?:      string
  stage?:  string
  source?: string
  marina?: string
  page?:   string
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await getCrmSession()
  if (!session) return null

  const page  = Math.max(1, parseInt(searchParams.page ?? '1'))
  const limit = 50

  const where = {
    companyId: session.user.companyId,
    active:    true,
    ...(searchParams.stage  && { funnelStage: searchParams.stage as FunnelStage }),
    ...(searchParams.source && { source: searchParams.source as ClientSource }),
    ...(searchParams.marina && { marina: searchParams.marina }),
    ...(searchParams.q && {
      OR: [
        { firstName: { contains: searchParams.q, mode: 'insensitive' as const } },
        { lastName:  { contains: searchParams.q, mode: 'insensitive' as const } },
        { phone:     { contains: searchParams.q, mode: 'insensitive' as const } },
        { email:     { contains: searchParams.q, mode: 'insensitive' as const } },
        { marina:    { contains: searchParams.q, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        yachts: { select: { model: true, marina: true } },
        _count: { select: { tasks: true, invoices: true, quotes: true } },
      },
    }),
    prisma.client.count({ where }),
  ])

  const serializedClients = clients.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-heading font-bold text-gray-900">Клиенты</h1>
          <p className="text-label text-gray-500 mt-0.5">{total} клиентов</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton
            filename="clients"
            headers={['Имя', 'Телефон', 'Email', 'Марина', 'Стадия', 'Источник', 'Создан']}
            rows={serializedClients.map((r) => [
              `${r.firstName} ${r.lastName}`, r.phone, r.email, r.marina,
              FUNNEL_STAGE_LABELS[r.funnelStage] ?? r.funnelStage, r.source,
              new Date(r.createdAt).toLocaleDateString('ru-RU'),
            ])}
          />
          <Link href="/crm/clients/import" className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 text-body px-4 py-2 rounded-control transition">
            ⬆ Импорт CSV
          </Link>
          <Link href="/crm/clients/new" className="bg-gold hover:bg-gold-light text-navy font-semibold text-body px-4 py-2 rounded-control transition">
            + Новый клиент
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Suspense>
            <ClientFilters />
          </Suspense>
        </div>

        <ClientsTable
          clients={serializedClients}
          total={total}
        />

        {total > limit && (
          <div className="flex gap-2 mt-5 justify-center">
            {Array.from({ length: Math.ceil(total / limit) }, (_, i) => (
              <Link
                key={i}
                href={`/crm/clients?${new URLSearchParams({ ...searchParams, page: String(i + 1) })}`}
                className={`px-3 py-1.5 rounded-control text-body transition ${page === i + 1 ? 'bg-gold text-navy font-bold' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {i + 1}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}