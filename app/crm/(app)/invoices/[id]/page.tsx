import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, INVOICE_STATUS_LABELS, LANGUAGE_LABELS } from '@/lib/crm/utils'
import { Badge, INVOICE_TONE } from '@/components/crm/ui'
import { InvoiceActions } from '@/components/crm/invoices/InvoiceActions'
import { computeInvoiceMargin } from '@/lib/crm/services/profitability'
import Decimal from 'decimal.js'

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

const STOCK_MOVE_LABEL: Record<string, string> = {
  WRITE_OFF: 'Списано',
  RECEIVE:   'Возврат на склад',
  SELL:      'Продано',
  ADJUST:    'Корректировка',
  ORDER:     'Заказ',
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE:        'Счёт создан',
  UPDATE:        'Счёт отредактирован',
  STATUS_CHANGE: 'Статус изменён',
  DELETE:        'Удалено',
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
      vatEntries: { where: { direction: 'REPERCUTIDO' } },
      stockMovements: { orderBy: { createdAt: 'desc' }, include: { item: { select: { name: true, unit: true } } } },
    },
  })
  if (!invoice) notFound()

  const paidNet = invoice.finances
    .filter((f) => f.type === 'INCOME')
    .reduce((s, f) => s.plus(f.amount.toString()), new Decimal(0))

  const margin = await computeInvoiceMargin(invoice.id)

  const auditTrail = await prisma.auditLog.findMany({
    where:   { companyId: session.user.companyId, entity: 'Invoice', entityId: invoice.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  })

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/invoices" className="text-gray-500 hover:text-gray-900 text-body transition">← Счета</Link>
          <span className="text-gray-500">/</span>
          <h1 className="text-heading font-bold text-gray-900 font-mono">{invoice.number}</h1>
          <Badge tone={INVOICE_TONE[invoice.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
        </div>
        <InvoiceActions
          id={invoice.id}
          number={invoice.number}
          status={invoice.status}
          hasEmail={!!invoice.client.email}
          isAdmin={session.user.role === 'ADMIN'}
          paidNet={paidNet.toString()}
          ivaRate={invoice.ivaRate.toString()}
        />
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

          {margin && (
            <Card title="Маржа по сделке">
              <InfoRow label="Выручка" value={<span className="tabular-nums">{formatMoney(margin.revenueNet)}</span>} />
              <InfoRow label="Материалы (себест.)" value={<span className="tabular-nums text-danger">−{formatMoney(margin.materialCost)}</span>} />
              <InfoRow
                label="Маржа"
                value={
                  <span className={`tabular-nums font-semibold ${margin.margin.isNegative() ? 'text-danger' : 'text-success'}`}>
                    {formatMoney(margin.margin)}{margin.marginPct != null && ` (${margin.marginPct.toFixed(0)}%)`}
                  </span>
                }
              />
              <p className="text-label text-gray-500 pt-1">Себестоимость труда не учтена — в системе нет ставки часа сотрудника.</p>
            </Card>
          )}

          {invoice.finances.length > 0 && (
            <Card title="Связанные платежи">
              {invoice.finances.map((f) => {
                const vat = invoice.vatEntries.find((v) => v.financeEntryId === f.id)
                const gross = vat ? f.amount.plus(vat.amount) : f.amount
                const isRefund = f.amount.isNegative()
                return (
                  <div key={f.id} className="space-y-1">
                    <div className="flex justify-between text-body">
                      <span className="text-gray-500">{f.autoId} · {isRefund ? 'возврат' : 'получено'}</span>
                      <span className={`font-semibold tabular-nums ${isRefund ? 'text-danger' : 'text-gray-900'}`}>{formatMoney(gross)}</span>
                    </div>
                    <div className="flex justify-between text-label pl-2">
                      <span className="text-gray-500">— {isRefund ? 'сторно дохода в P&L' : 'доход в P&L (нетто)'}</span>
                      <span className={`tabular-nums ${isRefund ? 'text-danger' : 'text-success'}`}>{isRefund ? '' : '+'}{formatMoney(f.amount)}</span>
                    </div>
                    {vat && (
                      <div className="flex justify-between text-label pl-2">
                        <span className="text-gray-500">— IVA repercutido (не прибыль)</span>
                        <span className="text-warning tabular-nums">{formatMoney(vat.amount)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </Card>
          )}

          {invoice.notes && (
            <Card title="Примечания">
              <p className="text-body text-gray-900">{invoice.notes}</p>
            </Card>
          )}

          <Card title="След документа">
            {invoice.stockMovements.length === 0 && invoice.finances.length === 0 && auditTrail.length === 0 ? (
              <p className="text-label text-gray-500">Пока нет движений — они появятся при выставлении, оплате или отмене.</p>
            ) : (
              <div className="space-y-1.5">
                {invoice.stockMovements.map((mv) => (
                  <TrailRow
                    key={mv.id}
                    date={mv.createdAt}
                    text={`${STOCK_MOVE_LABEL[mv.type] ?? mv.type}: ${mv.item.name} ×${mv.qty.toString()} ${mv.item.unit}`}
                  />
                ))}
                {invoice.finances.map((f) => (
                  <TrailRow
                    key={f.id}
                    date={f.createdAt}
                    text={`Финансы: ${f.autoId} — ${f.amount.isNegative() ? 'возврат (нетто)' : 'доход (нетто)'} ${formatMoney(f.amount)}`}
                  />
                ))}
                {auditTrail.map((a) => (
                  <TrailRow
                    key={a.id}
                    date={a.createdAt}
                    text={`${AUDIT_ACTION_LABEL[a.action] ?? a.action}${a.user ? ` · ${a.user.name}` : ''}`}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Правая колонка — позиции и итог */}
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
                {invoice.jobs.map((job, ji) => (
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
                        <td className="px-3 py-2 text-body text-gray-500 text-right tabular-nums border-r border-r-gray-200">—</td>
                        <td className="px-3 py-2 text-body text-gray-500 text-right tabular-nums border-r border-r-gray-200">—</td>
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
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.jobsTotal)}</span>
                </div>
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">Итого материалы</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.materialsTotal)}</span>
                </div>
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">База</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                  <span className="text-gray-500">IVA ({invoice.ivaRate.toString()}%)</span>
                  <span className="text-gray-900 tabular-nums">{formatMoney(invoice.ivaAmount)}</span>
                </div>
                {Number(invoice.irpfAmount) > 0 && (
                  <div className="flex justify-between text-body px-3 py-2 border-b border-gray-200 bg-white">
                    <span className="text-gray-500">IRPF ({invoice.irpfRate.toString()}%)</span>
                    <span className="text-danger tabular-nums">−{formatMoney(invoice.irpfAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-3 py-3 bg-navy-900 border-t-2 border-t-gold">
                  <span className="text-white font-bold text-label uppercase tracking-wide">Итого</span>
                  <span className="text-gold font-bold text-subheading tabular-nums">{formatMoney(invoice.total)}</span>
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

function TrailRow({ date, text }: { date: Date; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-400 text-label w-24 shrink-0 tabular-nums">{fmtDateTime(date)}</span>
      <span className="text-gray-700 text-label flex-1">{text}</span>
    </div>
  )
}