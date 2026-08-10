import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, QUOTE_STATUS_LABELS, LANGUAGE_LABELS } from '@/lib/crm/utils'
import { Badge, QUOTE_TONE } from '@/components/crm/ui'
import { QuoteActions } from '@/components/crm/invoices/QuoteActions'

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const quote = await prisma.quote.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
      invoices: { select: { id: true, number: true } },
    },
  })
  if (!quote) notFound()

  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/quotes/${quote.publicToken}`

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/invoices?tab=quotes" className="text-gray-200 hover:text-gray-500 text-body transition">← Пресметы</Link>
          <span className="text-gray-200">/</span>
          <h1 className="text-heading font-bold text-gray-900 font-mono">{quote.number}</h1>
          <Badge tone={QUOTE_TONE[quote.status] ?? 'neutral'}>{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</Badge>
        </div>
        <QuoteActions id={quote.id} status={quote.status} hasEmail={!!quote.client.email} />
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <Card title="Клиент">
            <InfoRow label="Имя" value={
              <Link href={`/crm/clients/${quote.client.id}`} className="text-gold hover:underline">{quote.client.firstName} {quote.client.lastName}</Link>
            } />
            {quote.client.email && <InfoRow label="Email" value={quote.client.email} />}
          </Card>

          <Card title="Детали пресмета">
            <InfoRow label="Создан" value={fmtDate(quote.createdAt)} />
            {quote.validUntil && <InfoRow label="Действителен до" value={fmtDate(quote.validUntil)} />}
            {quote.acceptedAt && <InfoRow label="Решение" value={fmtDate(quote.acceptedAt)} />}
            <InfoRow label="Язык" value={LANGUAGE_LABELS[quote.language] ?? quote.language} />
          </Card>

          <Card title="Публичная ссылка">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-gold text-label break-all hover:underline">
              {publicUrl}
            </a>
          </Card>

          {quote.invoices.length > 0 && (
            <Card title="Связанные счета">
              <p className="text-label text-gray-500 mb-1">
                По этой смете уже есть счёт — при правке пресмета счёт не меняется автоматически.
              </p>
              {quote.invoices.map((inv) => (
                <Link key={inv.id} href={`/crm/invoices/${inv.id}`} className="block text-gold font-mono text-body hover:underline">
                  {inv.number}
                </Link>
              ))}
            </Card>
          )}

          {quote.notes && (
            <Card title="Примечания">
              <p className="text-body text-gray-900">{quote.notes}</p>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-card shadow-e2 border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EEF1F5] border-b-2 border-b-navy">
                  <th className="px-2 py-2.5 text-left text-label text-navy-900 uppercase tracking-wide font-bold border-r border-r-gray-200 w-10">№</th>
                  <th className="px-2 py-2.5 text-left text-label text-navy-900 uppercase tracking-wide font-bold border-r border-r-gray-200">Описание</th>
                  <th className="px-3 py-2.5 text-right text-label text-navy-900 uppercase tracking-wide font-bold border-r border-r-gray-200">Часы</th>
                  <th className="px-3 py-2.5 text-right text-label text-navy-900 uppercase tracking-wide font-bold border-r border-r-gray-200">Норма/ч</th>
                  <th className="px-3 py-2.5 text-right text-label text-navy-900 uppercase tracking-wide font-bold border-r border-r-gray-200">Кол-во</th>
                  <th className="px-3 py-2.5 text-right text-label text-navy-900 uppercase tracking-wide font-bold border-r border-r-gray-200">Цена за ед.</th>
                  <th className="px-4 py-2.5 text-right text-label text-navy-900 uppercase tracking-wide font-bold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {quote.jobs.map((job, ji) => (
                  <Fragment key={job.id}>
                    <tr className="bg-white border-b border-b-gray-200">
                      <td className="px-2 py-2.5 text-body text-navy-900 font-bold tabular-nums border-r border-r-gray-200 border-l-[3px] border-l-gold">{ji + 1}</td>
                      <td className="px-2 py-2.5 text-body text-navy-900 font-bold border-r border-r-gray-200">{job.title}</td>
                      <td className="px-3 py-2.5 text-body text-navy-900 text-right tabular-nums border-r border-r-gray-200">{job.laborHours?.toString() ?? '—'}</td>
                      <td className="px-3 py-2.5 text-body text-navy-900 text-right tabular-nums border-r border-r-gray-200">{job.laborRate ? formatMoney(job.laborRate) : '—'}</td>
                      <td className="px-3 py-2.5 text-body text-navy-900 text-right tabular-nums border-r border-r-gray-200">{job.quantity?.toString() ?? '—'}</td>
                      <td className="px-3 py-2.5 text-body text-navy-900 text-right tabular-nums border-r border-r-gray-200">{job.unitPrice ? formatMoney(job.unitPrice) : '—'}</td>
                      <td className="px-4 py-2.5 text-body text-navy-900 text-right tabular-nums font-bold">{formatMoney(job.laborCost)}</td>
                    </tr>
                    {job.materials.map((m, mi) => (
                      <tr key={m.id} className="bg-gray-50/40 border-b border-b-gray-200 last:border-0">
                        <td className="px-2 py-2 text-label text-gray-500 tabular-nums border-r border-r-gray-200 border-l-[3px] border-l-transparent">{ji + 1}.{mi + 1}</td>
                        <td className="px-2 py-2 pl-6 text-body text-gray-700 border-r border-r-gray-200">{m.name}</td>
                        <td className="px-3 py-2 text-body text-gray-300 text-right tabular-nums border-r border-r-gray-200">—</td>
                        <td className="px-3 py-2 text-body text-gray-300 text-right tabular-nums border-r border-r-gray-200">—</td>
                        <td className="px-3 py-2 text-body text-gray-700 text-right tabular-nums border-r border-r-gray-200">{m.quantity.toString()}</td>
                        <td className="px-3 py-2 text-body text-gray-700 text-right tabular-nums border-r border-r-gray-200">{formatMoney(m.unitPrice)}</td>
                        <td className="px-4 py-2 text-body text-gray-700 text-right tabular-nums">{formatMoney(m.total)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="ml-auto w-64 border border-gray-200 rounded-control overflow-hidden">
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">Итого работа</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(quote.jobsTotal)}</span>
                </div>
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">Итого материалы</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(quote.materialsTotal)}</span>
                </div>
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">База</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">IVA ({quote.ivaRate.toString()}%)</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(quote.ivaAmount)}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-3 bg-navy-900 border-t-2 border-t-gold">
                  <span className="text-white font-bold text-label uppercase tracking-wide">Итого</span>
                  <span className="text-gold font-bold text-subheading tabular-nums">{formatMoney(quote.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
      <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 text-label w-32 shrink-0">{label}</span>
      <span className="text-gray-900 text-body">{value}</span>
    </div>
  )
}