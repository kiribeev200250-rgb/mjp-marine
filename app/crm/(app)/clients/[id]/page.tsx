import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { FUNNEL_STAGE_LABELS, FUNNEL_STAGE_LABELS as FSL, INVOICE_STATUS_LABELS, TASK_STATUS_LABELS } from '@/lib/crm/utils'
import { Badge, FUNNEL_TONE, TASK_TONE, INVOICE_TONE, Button } from '@/components/crm/ui'

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
  params: { id: string }
}) {
  const session = await getCrmSession()
  if (!session) return null

  const client = await prisma.client.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: {
      yachts:       { orderBy: { createdAt: 'asc' } },
      stageHistory: { orderBy: { createdAt: 'desc' } },
      quotes:       { orderBy: { createdAt: 'desc' } },
      tasks:        { orderBy: { scheduledAt: 'desc' } },
      invoices:     { orderBy: { date: 'desc' } },
      finances:     { orderBy: { date: 'desc' }, take: 10 },
    },
  })

  if (!client) notFound()

  const stageIndex = STAGE_ORDER.indexOf(client.funnelStage)

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/clients" className="text-gray-200 hover:text-gray-500 text-body transition">← Клиенты</Link>
          <span className="text-gray-200">/</span>
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
                  <p className="text-label text-gray-500 mb-1">Заметки</p>
                  <p className="text-body text-gray-900">{client.notes}</p>
                </div>
              )}
            </Card>

            <Card title="Воронка">
              <div className="space-y-2">
                {STAGE_ORDER.map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${i <= stageIndex ? STAGE_DOT[stage] ?? 'bg-gray-200' : 'bg-gray-100'}`} />
                    <span className={`text-body ${i === stageIndex ? 'text-gray-900 font-semibold' : i < stageIndex ? 'text-gray-200 line-through' : 'text-gray-200'}`}>
                      {FUNNEL_STAGE_LABELS[stage]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {client.yachts.length > 0 && (
              <Card title="Яхты">
                {client.yachts.map((y) => (
                  <p key={y.id} className="text-body text-gray-900">
                    ⛵ {y.model || 'Без названия'}{y.length ? ` · ${y.length} м` : ''}{y.marina ? ` · ${y.marina}` : ''}
                  </p>
                ))}
              </Card>
            )}
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

            {client.tasks.length > 0 && (
              <Section title={`Задачи (${client.tasks.length})`}>
                {client.tasks.slice(0, 5).map((t) => (
                  <TimelineItem
                    key={t.id}
                    date={t.scheduledAt ?? t.createdAt}
                    title={t.title}
                    badge={<Badge tone={TASK_TONE[t.status] ?? 'neutral'} className="text-[10px]">{TASK_STATUS_LABELS[t.status] ?? t.status}</Badge>}
                    href={`/crm/schedule/${t.id}`}
                  />
                ))}
              </Section>
            )}

            {client.quotes.length > 0 && (
              <Section title={`Пресметы (${client.quotes.length})`}>
                {client.quotes.map((q) => (
                  <TimelineItem
                    key={q.id}
                    date={q.createdAt}
                    title={`${q.number} — ${Number(q.total).toFixed(2)} €`}
                    badge={<Badge tone="neutral" className="text-[10px]">{q.status}</Badge>}
                    href={`/crm/invoices/quote/${q.id}`}
                  />
                ))}
              </Section>
            )}

            {client.invoices.length > 0 && (
              <Section title={`Счета (${client.invoices.length})`}>
                {client.invoices.map((inv) => (
                  <TimelineItem
                    key={inv.id}
                    date={inv.date}
                    title={`${inv.number} — ${Number(inv.total).toFixed(2)} €`}
                    badge={<Badge tone={INVOICE_TONE[inv.status] ?? 'neutral'} className="text-[10px]">{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge>}
                    href={`/crm/invoices/${inv.id}`}
                  />
                ))}
              </Section>
            )}

            {client.stageHistory.length > 0 && (
              <Section title="История воронки">
                {client.stageHistory.map((h) => (
                  <TimelineItem
                    key={h.id}
                    date={h.createdAt}
                    title={h.fromStage
                      ? `${FUNNEL_STAGE_LABELS[h.fromStage]} → ${FUNNEL_STAGE_LABELS[h.toStage]}`
                      : FUNNEL_STAGE_LABELS[h.toStage]}
                    note={h.note || undefined}
                  />
                ))}
              </Section>
            )}

            {client.tasks.length === 0 && client.quotes.length === 0 && client.invoices.length === 0 && (
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
      {note && <span className="text-gray-200 text-label italic shrink-0">{note}</span>}
    </div>
  )
  return href
    ? <Link href={href} className="block hover:bg-gray-50/70 transition">{content}</Link>
    : <div>{content}</div>
}