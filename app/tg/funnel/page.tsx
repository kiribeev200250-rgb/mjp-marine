'use client'

import { useEffect, useState } from 'react'
import { useTg } from '@/components/tg/TgProvider'
import { TgShell } from '@/components/tg/TgShell'
import { TgCard, TgButton, TgSpinner, TgEmpty } from '@/components/tg/ui'
import { Badge, FUNNEL_TONE } from '@/components/crm/ui/Badge'
import { FUNNEL_STAGE_LABELS, formatMoney } from '@/lib/crm/utils'

const STAGES = [
  'NEW_LEAD', 'CONTACT_MADE', 'QUOTE_SENT', 'WORK_SCHEDULED', 'WORK_DONE', 'INVOICE_SENT', 'PAID',
] as const
type Stage = typeof STAGES[number]

interface FunnelClient {
  id: string
  firstName: string
  lastName: string
  marina: string
  source: string
  phone: string
  email: string
  funnelStage: Stage
  openInvoiceTotal: number
}

export default function TgFunnelPage() {
  const { ready, tgFetch, haptic } = useTg()
  const [clients, setClients] = useState<FunnelClient[] | null>(null)
  const [activeStage, setActiveStage] = useState<Stage>('NEW_LEAD')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    tgFetch('/api/tg/funnel').then((r) => r.json()).then(setClients).catch(() => setClients([]))
  }

  useEffect(() => { if (ready) load() }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = async (client: FunnelClient) => {
    const idx = STAGES.indexOf(client.funnelStage)
    if (idx === STAGES.length - 1) return
    const toStage = STAGES[idx + 1]
    setBusyId(client.id)
    const res = await tgFetch('/api/tg/funnel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, toStage }),
    })
    setBusyId(null)
    if (res.ok) {
      haptic('medium')
      setClients((prev) => prev?.map((c) => (c.id === client.id ? { ...c, funnelStage: toStage } : c)) ?? null)
    }
  }

  const byStage = (stage: Stage) => clients?.filter((c) => c.funnelStage === stage) ?? []

  return (
    <TgShell title="Воронка продаж">
      {clients === null ? (
        <TgSpinner />
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-3 px-3">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setActiveStage(s)}
                className={
                  'shrink-0 px-3 py-1.5 rounded-chip text-xs font-semibold whitespace-nowrap ' +
                  (activeStage === s ? 'bg-navy text-white' : 'bg-white text-gray-500 border border-gray-200')
                }
              >
                {FUNNEL_STAGE_LABELS[s]} · {byStage(s).length}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {byStage(activeStage).length === 0 && <TgEmpty text="Нет клиентов на этой стадии" />}
            {byStage(activeStage).map((c) => (
              <TgCard key={c.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900 text-sm">{c.firstName} {c.lastName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{c.marina || '—'} · {c.source || '—'}</div>
                  </div>
                  <Badge tone={FUNNEL_TONE[c.funnelStage]}>{FUNNEL_STAGE_LABELS[c.funnelStage]}</Badge>
                </div>
                {c.openInvoiceTotal > 0 && (
                  <div className="text-xs text-gray-500">
                    Открытый счёт: <span className="tabular-nums font-semibold text-navy-900">{formatMoney(c.openInvoiceTotal)}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex-1">
                      <TgButton variant="ghost" className="w-full">📞 Позвонить</TgButton>
                    </a>
                  )}
                  {c.funnelStage !== 'PAID' && (
                    <TgButton
                      variant="secondary"
                      className="flex-1"
                      disabled={busyId === c.id}
                      onClick={() => advance(c)}
                    >
                      {busyId === c.id ? '...' : `→ ${FUNNEL_STAGE_LABELS[STAGES[STAGES.indexOf(c.funnelStage) + 1]]}`}
                    </TgButton>
                  )}
                </div>
              </TgCard>
            ))}
          </div>
        </>
      )}
    </TgShell>
  )
}
