import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { formatMoney, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS, TASK_STATUS_LABELS } from '@/lib/crm/utils'
import { Badge, INVOICE_TONE, QUOTE_TONE, TASK_TONE, Button } from '@/components/crm/ui'
import { BoatEditForm } from '@/components/crm/clients/BoatEditForm'
import { NotesThread } from '@/components/crm/clients/NotesThread'
import { computeBoatMargin } from '@/lib/crm/services/profitability'

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}

export default async function BoatDetailPage({ params }: { params: Promise<{ id: string; boatId: string }> }) {
  const { id: clientId, boatId } = await params
  const session = await getCrmSession()
  if (!session) return null

  const boat = await prisma.yacht.findFirst({
    where:   { id: boatId, clientId, client: { companyId: session.user.companyId } },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!boat) notFound()

  const [quotes, invoices, tasks, notes, movements, payments, allClients] = await Promise.all([
    prisma.quote.findMany({ where: { boatId }, orderBy: { createdAt: 'desc' } }),
    prisma.invoice.findMany({ where: { boatId }, orderBy: { date: 'desc' } }),
    prisma.task.findMany({ where: { boatId }, orderBy: { scheduledAt: 'desc' } }),
    prisma.note.findMany({ where: { boatId }, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } }),
    prisma.stockMovement.findMany({ where: { invoice: { boatId } }, include: { item: { select: { name: true, unit: true } }, invoice: { select: { number: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.financeEntry.findMany({ where: { invoice: { boatId } }, include: { invoice: { select: { number: true } } }, orderBy: { date: 'desc' } }),
    prisma.client.findMany({ where: { companyId: session.user.companyId, active: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: 'asc' } }),
  ])

  const paidTotal = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0)
  const debtTotal = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'PARTIAL' || i.status === 'OVERDUE').reduce((s, i) => s + Number(i.total), 0)
  const margin = await computeBoatMargin(boatId)

  type FeedEvent = { date: Date; title: string; badge?: React.ReactNode; href?: string }
  const feed: FeedEvent[] = [
    ...quotes.map((q): FeedEvent => ({
      date: q.createdAt, title: `Пресмет ${q.number} — ${formatMoney(q.total)}`,
      badge: <Badge tone={QUOTE_TONE[q.status] ?? 'neutral'}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Badge>,
      href: `/crm/invoices/quote/${q.id}`,
    })),
    ...invoices.map((inv): FeedEvent => ({
      date: inv.date, title: `Счёт ${inv.number} — ${formatMoney(inv.total)}`,
      badge: <Badge tone={INVOICE_TONE[inv.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge>,
      href: `/crm/invoices/${inv.id}`,
    })),
    ...tasks.map((t): FeedEvent => ({
      date: t.scheduledAt ?? t.createdAt, title: `Задача: ${t.title}`,
      badge: <Badge tone={TASK_TONE[t.status] ?? 'neutral'}>{TASK_STATUS_LABELS[t.status] ?? t.status}</Badge>,
      href: `/crm/schedule/${t.id}`,
    })),
    ...movements.map((mv): FeedEvent => ({
      date: mv.createdAt,
      title: `${mv.type === 'WRITE_OFF' ? 'Списано' : mv.type === 'RECEIVE' ? 'Возврат на склад' : mv.type}: ${mv.item.name} ×${mv.qty.toString()} ${mv.item.unit}${mv.invoice ? ` (${mv.invoice.number})` : ''}`,
    })),
    ...payments.map((p): FeedEvent => {
      const isRefund = Number(p.amount) < 0
      return {
        date: p.date,
        title: `${isRefund ? 'Возврат' : 'Оплата'} ${p.autoId} — ${formatMoney(Math.abs(Number(p.amount)))}${p.invoice ? ` (${p.invoice.number})` : ''}`,
        badge: <Badge tone={isRefund ? 'warning' : 'success'}>{isRefund ? 'Возврат' : 'Оплачено'}</Badge>,
      }
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const qs = `clientId=${clientId}&boatId=${boatId}`

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/crm/clients/${clientId}`} className="text-gray-500 hover:text-gray-900 text-body transition">← {boat.client.firstName} {boat.client.lastName}</Link>
          <span className="text-gray-500">/</span>
          <h1 className="text-heading font-bold text-gray-900">⛵ {boat.name || boat.model || 'Без названия'}</h1>
        </div>
        <BoatEditForm
          boat={{
            id: boat.id, clientId: boat.clientId, name: boat.name, model: boat.model,
            length: boat.length?.toString() ?? '', engine: boat.engine, marina: boat.marina,
            regNumber: boat.regNumber, notes: boat.notes,
          }}
          clients={allClients}
        />
      </div>

      <div className="bg-white border-b border-gray-200 px-6 py-3 grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        <Summary label="Оплачено всего" value={formatMoney(paidTotal)} />
        <Summary label="В дебиторке" value={formatMoney(debtTotal)} danger={debtTotal > 0} />
        <Summary
          label="Маржа по сделкам"
          value={`${formatMoney(margin.margin)}${margin.marginPct != null ? ` (${margin.marginPct.toFixed(0)}%)` : ''}`}
          danger={margin.margin.isNegative()}
        />
        <Summary label="Сметы / Счета" value={`${quotes.length} / ${invoices.length}`} />
        <Summary label="Последняя активность" value={feed[0] ? fmtDate(feed[0].date) : '—'} />
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
            <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-3">Данные лодки</h2>
            <InfoRow label="Модель" value={boat.model || '—'} />
            <InfoRow label="Длина" value={boat.length ? `${boat.length.toString()} м` : '—'} />
            <InfoRow label="Двигатель" value={boat.engine || '—'} />
            <InfoRow label="Марина" value={boat.marina || '—'} />
            <InfoRow label="Рег. номер" value={boat.regNumber || '—'} />
            {boat.notes && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-label text-gray-500 mb-1">Заметка</p>
                <p className="text-body text-gray-900">{boat.notes}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link href={`/crm/invoices/quote/new?${qs}`}>
              <Button variant="secondary" size="sm">📄 Смета</Button>
            </Link>
            <Link href={`/crm/invoices/new?${qs}`}>
              <Button variant="secondary" size="sm">🧾 Счёт</Button>
            </Link>
            <Link href={`/crm/schedule/new?${qs}`}>
              <Button variant="secondary" size="sm">📋 Задача</Button>
            </Link>
          </div>

          <NotesThread boatId={boat.id} initial={notes.map((n) => ({
            id: n.id, text: n.text, createdAt: n.createdAt.toISOString(), authorName: n.author?.name ?? null,
          }))} />
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-gray-200 rounded-card shadow-e2 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200">
              <h3 className="text-label text-gray-500 font-semibold uppercase tracking-wide">История лодки ({feed.length})</h3>
            </div>
            {feed.length === 0 ? (
              <p className="text-body text-gray-500 text-center py-8">Пока пусто — начните со сметы или задачи</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {feed.map((e, i) => {
                  const content = (
                    <div className="px-5 py-3 flex items-center gap-3">
                      <span className="text-gray-500 text-label w-16 shrink-0 tabular-nums">{fmtDate(e.date)}</span>
                      <span className="text-gray-900 text-body flex-1">{e.title}</span>
                      {e.badge}
                    </div>
                  )
                  return e.href
                    ? <Link key={i} href={e.href} className="block hover:bg-gray-50/70 transition">{content}</Link>
                    : <div key={i}>{content}</div>
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function Summary({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-label text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-body font-semibold tabular-nums ${danger ? 'text-danger' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-0.5">
      <span className="text-gray-500 text-label w-24 shrink-0">{label}</span>
      <span className="text-gray-900 text-body">{value}</span>
    </div>
  )
}
