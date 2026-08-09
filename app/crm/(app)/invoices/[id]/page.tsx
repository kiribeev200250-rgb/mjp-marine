import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, INVOICE_STATUS_LABELS, LANGUAGE_LABELS } from '@/lib/crm/utils'
import { Badge, INVOICE_TONE } from '@/components/crm/ui'
import { InvoiceActions } from '@/components/crm/invoices/InvoiceActions'

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const invoice = await prisma.invoice.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: {
      jobs:   { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
      quote:  { select: { id: true, number: true } },
      finances: true,
    },
  })
  if (!invoice) notFound()

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/invoices" className="text-gray-200 hover:text-gray-500 text-body transition">← Счета</Link>
          <span className="text-gray-200">/</span>
          <h1 className="text-heading font-bold text-gray-900 font-mono">{invoice.number}</h1>
          <Badge tone={INVOICE_TONE[invoice.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
        </div>
        <InvoiceActions id={invoice.id} status={invoice.status} hasEmail={!!invoice.client.email} />
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка — реквизиты */}
        <div className="space-y-5">
          <Card title="Клиент">
            <InfoRow label="Имя" value={
              <Link href={`/crm/clients/${invoice.client.id}`} className="text-gold hover:underline">{invoice.clientName}</Link>
            } />
            {invoice.clientNif && <InfoRow label="NIF" value={invoice.clientNif} />}
            {invoice.clientAddress && <InfoRow label="Адрес" value={invoice.clientAddress} />}
            {invoice.client.email && <InfoRow label="Email" value={invoice.client.email} />}
          </Card>

          <Card title="Детали счёта">
            <InfoRow label="Дата" value={fmtDate(invoice.date)} />
            {invoice.dueDate && <InfoRow label="Срок оплаты" value={fmtDate(invoice.dueDate)} />}
            {invoice.paidAt && <InfoRow label="Оплачен" value={fmtDate(invoice.paidAt)} />}
            {invoice.paymentMethod && <InfoRow label="Оплата" value={invoice.paymentMethod} />}
            <InfoRow label="Язык" value={LANGUAGE_LABELS[invoice.language] ?? invoice.language} />
            {invoice.quote && (
              <InfoRow label="Из пресмета" value={
                <Link href={`/crm/invoices/quote/${invoice.quote.id}`} className="text-gold hover:underline font-mono">{invoice.quote.number}</Link>
              } />
            )}
          </Card>

          {invoice.finances.length > 0 && (
            <Card title="Связанные платежи">
              {invoice.finances.map((f) => (
                <div key={f.id} className="flex justify-between text-body">
                  <span className="text-gray-500">{f.autoId}</span>
                  <span className="text-success font-semibold tabular-nums">+{formatMoney(f.amount)}</span>
                </div>
              ))}
            </Card>
          )}

          {invoice.notes && (
            <Card title="Примечания">
              <p className="text-body text-gray-900">{invoice.notes}</p>
            </Card>
          )}
        </div>

        {/* Правая колонка — позиции и итог */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold w-10">№</th>
                  <th className="px-2 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold">Описание</th>
                  <th className="px-3 py-2.5 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Часы</th>
                  <th className="px-3 py-2.5 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Норма/ч</th>
                  <th className="px-3 py-2.5 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Кол-во</th>
                  <th className="px-3 py-2.5 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Цена за ед.</th>
                  <th className="px-4 py-2.5 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {invoice.jobs.map((job, ji) => (
                  <Fragment key={job.id}>
                    <tr className="border-b border-gray-100 bg-navy-900/5">
                      <td className="px-2 py-2.5 text-body text-navy-900 font-bold tabular-nums">{ji + 1}</td>
                      <td className="px-2 py-2.5 text-body text-navy-900 font-bold">{job.title}</td>
                      <td className="px-3 py-2.5 text-body text-navy-900 text-right tabular-nums">{job.laborHours?.toString() ?? '—'}</td>
                      <td className="px-3 py-2.5 text-body text-navy-900 text-right tabular-nums">{job.laborRate ? formatMoney(job.laborRate) : '—'}</td>
                      <td className="px-3 py-2.5 text-body text-gray-300 text-right tabular-nums">—</td>
                      <td className="px-3 py-2.5 text-body text-gray-300 text-right tabular-nums">—</td>
                      <td className="px-4 py-2.5 text-body text-navy-900 text-right tabular-nums font-bold">{formatMoney(job.laborCost)}</td>
                    </tr>
                    {job.materials.map((m, mi) => (
                      <tr key={m.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-2 text-label text-gray-500 tabular-nums">{ji + 1}.{mi + 1}</td>
                        <td className="px-2 py-2 pl-6 text-body text-gray-700">{m.name}</td>
                        <td className="px-3 py-2 text-body text-gray-300 text-right tabular-nums">—</td>
                        <td className="px-3 py-2 text-body text-gray-300 text-right tabular-nums">—</td>
                        <td className="px-3 py-2 text-body text-gray-700 text-right tabular-nums">{m.quantity.toString()}</td>
                        <td className="px-3 py-2 text-body text-gray-700 text-right tabular-nums">{formatMoney(m.unitPrice)}</td>
                        <td className="px-4 py-2 text-body text-gray-700 text-right tabular-nums">{formatMoney(m.total)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="ml-auto w-64 space-y-1.5">
                <div className="flex justify-between text-body">
                  <span className="text-gray-500">Итого работа</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.jobsTotal)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-gray-500">Итого материалы</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.materialsTotal)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-gray-500">База</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-gray-500">IVA ({invoice.ivaRate.toString()}%)</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.ivaAmount)}</span>
                </div>
                {Number(invoice.irpfAmount) > 0 && (
                  <div className="flex justify-between text-body">
                    <span className="text-gray-500">IRPF ({invoice.irpfRate.toString()}%)</span>
                    <span className="text-danger tabular-nums">−{formatMoney(invoice.irpfAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
                  <span className="text-gray-900 font-bold text-subheading">Итого</span>
                  <span className="text-gray-900 font-bold text-subheading tabular-nums">{formatMoney(invoice.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-warning/10 border border-warning/30 rounded-card px-4 py-3">
            <p className="text-label text-warning">
              ⚠ Перед использованием сверьтесь с gestor’ом (бухгалтером) — документ носит информационный характер.
            </p>
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
      <span className="text-gray-500 text-label w-24 shrink-0">{label}</span>
      <span className="text-gray-900 text-body">{value}</span>
    </div>
  )
}