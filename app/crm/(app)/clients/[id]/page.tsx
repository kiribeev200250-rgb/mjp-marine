import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { FUNNEL_STAGE_LABELS, FUNNEL_STAGE_LABELS as FSL, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS, TASK_STATUS_LABELS, formatMoney } from '@/lib/crm/utils'
import { Badge, FUNNEL_TONE, TASK_TONE, INVOICE_TONE, QUOTE_TONE, Button } from '@/components/crm/ui'
import { NotesThread } from '@/components/crm/clients/NotesThread'
import { AddBoatButton } from '@/components/crm/clients/AddBoatButton'
import { computeClientMargin } from '@/lib/crm/services/profitability'
import { outstandingBalances } from '@/lib/crm/services/ar'
import { clientScopeWhere } from '@/lib/crm/scope'

const STAGE_ORDER = Object.keys(FSL)

const STAGE_DOT: Record<string, string> = {
  NEW_LEAD:       'bg-gray-200',
  CONTACT_MADE:   'bg-info',
  QUOTE_SENT:     'bg-purple-400',
  WORK_SCHEDULED: 'bg-warning',
  WORK_DONE:      'bg-teal-400',
  INVOICE_SENT:   'bg-warning',
  PAID:           'bg-success',
}

const LANG_FLAG: Record<string, string> = {
  ru: '🇷🇺', uk: '🇺🇦', en: '🇬🇧', es: '🇪🇸', pl: '🇵🇱',
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return null

  const client = await prisma.client.findFirst({
    where: { id, companyId: session.user.companyId, ...clientScopeWhere(session.user) },
    include: {
      yachts:       { where: { archived: false }, orderBy: { createdAt: 'asc' } },
      stageHistory: { orderBy: { createdAt: 'desc' } },
      quotes:       { orderBy: { createdAt: 'desc' } },
      tasks:        { orderBy: { scheduledAt: 'desc' } },
      invoices:     { orderBy: { date: 'desc' } },
      finances:     { orderBy: { date: 'desc' }, take: 10 },
      noteEntries:  { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
    },
  })

  if (!client) notFound()

  const stageIndex = STAGE_ORDER.indexOf(client.funnelStage)

  // ── Сводка по клиенту ────────────────────────────────────────────────────
  const paidTotal = client.invoices
    .filter((i) => i.status === 'PAID')
    .reduce((s, i) => s + Number(i.total), 0)
  const debtInvoices = client.invoices
    .filter((i) => i.status === 'ISSUED' || i.status === 'PARTIAL' || i.status === 'OVERDUE')
  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const balances = await outstandingBalances(debtInvoices)
  const debtTotal = debtInvoices
    .reduce((s, i) => s + balances.get(i.id)!.toNumber(), 0)
  const dealsCount = client.invoices.filter((i) => i.status === 'PAID').length
  const margin = await computeClientMargin(client.id)

  type FeedEvent = { date: Date; title: string; badge?: React.ReactNode; note?: string; href?: string }
  const feed: FeedEvent[] = [
    ...client.tasks.map((t): FeedEvent => ({
      date:  t.scheduledAt ?? t.createdAt,
      title: `Задача: ${t.title}`,
      badge: <Badge tone={TASK_TONE[t.status] ?? 'neutral'}>{TASK_STATUS_LABELS[t.status] ?? t.status}</Badge>,
      href:  `/crm/schedule/${t.id}`,
    })),
    ...client.quotes.map((q): FeedEvent => ({
      date:  q.createdAt,
      title: `Пресмет ${q.number} — ${formatMoney(q.total)}`,
      badge: <Badge tone={QUOTE_TONE[q.status] ?? 'neutral'}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Badge>,
      href:  `/crm/invoices/quote/${q.id}`,
    })),
    ...client.invoices.map((inv): FeedEvent => ({
      date:  inv.date,
      title: `Счёт ${inv.number} — ${formatMoney(inv.total)}`,
      badge: <Badge tone={INVOICE_TONE[inv.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge>,
      href:  `/crm/invoices/${inv.id}`,
    })),
    ...client.finances.filter((f) => f.type === 'INCOME' && f.invoiceId).map((f): FeedEvent => {
      const isRefund = Number(f.amount) < 0
      return {
        date:  f.date,
        title: isRefund
          ? `Возврат ${f.autoId} — ${formatMoney(Math.abs(Number(f.amount)))}`
          : `Оплата получена ${f.autoId} — ${formatMoney(f.amount)}`,
        badge: <Badge tone={isRefund ? 'warning' : 'success'}>{isRefund ? 'Возврат' : 'Оплачено'}</Badge>,
        href:  f.invoiceId ? `/crm/invoices/${f.invoiceId}` : undefined,
      }
    }),
    ...client.stageHistory.map((h): FeedEvent => ({
      date:  h.createdAt,
      title: h.fromStage
        ? `${FUNNEL_STAGE_LABELS[h.fromStage]} → ${FUNNEL_STAGE_LABELS[h.toStage]}`
        : FUNNEL_STAGE_LABELS[h.toStage],
      note: h.note || undefined,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/clients" className="text-gray-500 hover:text-gray-900 text-body transition">← Клиенты</Link>
          <span className="text-gray-500">/</span>
          <h1 className="text-heading font-bold text-gray-900">
            {client.firstName} {client.lastName}
          </h1>
          {client.marina && <span className="text-gray-500 text-body">{client.marina}</span>}
          <Badge tone={FUNNEL_TONE[client.funnelStage] ?? 'neutral'}>
            {FUNNEL_STAGE_LABELS[client.funnelStage]}
          </Badge>
        </div>
        <Link href={`/crm/clients/${client.id}/edit`}>
          <Button variant="secondary" size="sm">Редактировать</Button>
        </Link>
      </div>

      {/* Сводка по клиенту */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        <Summary label="Оплачено всего" value={formatMoney(paidTotal)} />
        <Summary label="В дебиторке" value={formatMoney(debtTotal)} danger={debtTotal > 0} />
        <Summary
          label="Маржа по сделкам"
          value={`${formatMoney(margin.margin)}${margin.marginPct != null ? ` (${margin.marginPct.toFixed(0)}%)` : ''}`}
          danger={margin.margin.isNegative()}
        />
        <Summary label="Сделок (оплачено)" value={String(dealsCount)} />
        <Summary label="Последняя активность" value={feed[0] ? new Date(feed[0].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'} />
      </div>

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка */}
          <div className="space-y-5">
            <Card title="Контакты">
              <InfoRow label="Имя" value={`${client.firstName} ${client.lastName}`} />
              {client.phone && <InfoRow label="Телефон" value={<a href={`tel:${client.phone}`} className="text-gold">{client.phone}</a>} />}
              {client.email && <InfoRow label="Email" value={<a href={`mailto:${client.email}`} className="text-gold">{client.email}</a>} />}
              {client.marina && <InfoRow label="Марина" value={client.marina} />}
              <InfoRow label="Язык" value={`${LANG_FLAG[client.language] ?? ''} ${client.language.toUpperCase()}`} />
              {client.notes && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-label text-gray-500 mb-1">Заметка</p>
                  <p className="text-body text-gray-900">{client.notes}</p>
                </div>
              )}
            </Card>

            <Card title="Воронка">
              <div className="space-y-2">
                {STAGE_ORDER.map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${i <= stageIndex ? STAGE_DOT[stage] ?? 'bg-gray-200' : 'bg-gray-100'}`} />
                    <span className={`text-body ${i === stageIndex ? 'text-gray-900 font-semibold' : i < stageIndex ? 'text-gray-500 line-through' : 'text-gray-500'}`}>
                      {FUNNEL_STAGE_LABELS[stage]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide">Лодки</h2>
                <AddBoatButton clientId={client.id} />
              </div>
              {client.yachts.length === 0 ? (
                <p className="text-body text-gray-500 text-center py-3">Лодок пока нет</p>
              ) : (
                <div className="space-y-2">
                  {client.yachts.map((y) => (
                    <Link
                      key={y.id}
                      href={`/crm/clients/${client.id}/boats/${y.id}`}
                      className="block px-3 py-2.5 rounded-control border border-gray-200 hover:border-gold hover:bg-gray-50/70 transition"
                    >
                      <p className="text-body font-medium text-gray-900">⛵ {y.name || y.model || 'Без названия'}</p>
                      <p className="text-label text-gray-500 mt-0.5">
                        {[y.model, y.length ? `${y.length} м` : null, y.marina].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <NotesThread clientId={client.id} initial={client.noteEntries.map((n) => ({
              id: n.id, text: n.text, createdAt: n.createdAt.toISOString(), authorName: n.author?.name ?? null,
            }))} />
          </div>

          {/* Правая колонка */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex gap-2 flex-wrap">
              <Link href={`/crm/schedule/new?clientId=${client.id}`}>
                <Button variant="secondary" size="sm">📋 Новая задача</Button>
              </Link>
              <Link href={`/crm/invoices/new?clientId=${client.id}`}>
                <Button variant="secondary" size="sm">🧾 Выставить счёт</Button>
              </Link>
              <Link href={`/crm/invoices/quote/new?clientId=${client.id}`}>
                <Button variant="secondary" size="sm">📄 Новый пресмет</Button>
              </Link>
            </div>

            {feed.length > 0 ? (
              <Section title={`Лента событий (${feed.length})`}>
                {feed.map((e, i) => (
                  <TimelineItem key={i} date={e.date} title={e.title} badge={e.badge} note={e.note} href={e.href} />
                ))}
              </Section>
            ) : (
              <div className="bg-white border border-gray-200 rounded-card p-8 text-center shadow-e1">
                <p className="text-gray-500 text-body">История пуста — добавь первую задачу или пресмет</p>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
      <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-4">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 text-label w-20 shrink-0">{label}</span>
      <span className="text-gray-900 text-body">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200">
        <h3 className="text-label text-gray-500 font-semibold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function TimelineItem({
  date, title, badge, note, href,
}: {
  date:   Date | string
  title:  string
  badge?: React.ReactNode
  note?:  string
  href?:  string
}) {
  const d = new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const content = (
    <div className="px-5 py-3 flex items-center gap-3">
      <span className="text-gray-500 text-label w-16 shrink-0 tabular-nums">{d}</span>
      <span className="text-gray-900 text-body flex-1">{title}</span>
      {badge}
      {note && <span className="text-gray-500 text-label italic shrink-0">{note}</span>}
    </div>
  )
  return href
    ? <Link href={href} className="block hover:bg-gray-50/70 transition">{content}</Link>
    : <div>{content}</div>
}