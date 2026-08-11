'use client'

import { useEffect, useState } from 'react'
import { useTg } from '@/components/tg/TgProvider'
import { TgShell } from '@/components/tg/TgShell'
import { TgCard, TgButton, TgSpinner, TgEmpty } from '@/components/tg/ui'
import { Badge, INVOICE_TONE } from '@/components/crm/ui/Badge'
import { formatMoney } from '@/lib/crm/utils'
import type { InvoiceStatus } from '@prisma/client'

interface Invoice {
  id: string
  number: string
  status: InvoiceStatus
  date: string
  dueDate: string | null
  total: string
  clientName: string
}

const STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Выставлен', PARTIAL: 'Частично оплачен', OVERDUE: 'Просрочен',
}

export default function TgInvoicesPage() {
  const { ready, tgFetch, haptic } = useTg()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = () => {
    tgFetch('/api/tg/invoices').then((r) => r.json()).then(setInvoices).catch(() => setInvoices([]))
  }

  useEffect(() => { if (ready) load() }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const markPaid = async (invoice: Invoice) => {
    setBusyId(invoice.id)
    setMsg(null)
    const res = await tgFetch(`/api/tg/invoices/${invoice.id}/pay`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) {
      haptic('medium')
      setInvoices((prev) => prev?.filter((i) => i.id !== invoice.id) ?? null)
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error ?? 'Ошибка')
    }
  }

  const total = invoices?.reduce((s, i) => s + Number(i.total), 0) ?? 0

  return (
    <TgShell title="Дебиторка">
      {invoices === null ? (
        <TgSpinner />
      ) : (
        <>
          {invoices.length > 0 && (
            <TgCard className="mb-3 flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Не оплачено</span>
              <span className="text-lg font-bold tabular-nums text-navy-900">{formatMoney(total)}</span>
            </TgCard>
          )}
          {msg && <div className="text-xs text-danger mb-2">{msg}</div>}
          {invoices.length === 0 ? (
            <TgEmpty text="Нет неоплаченных счетов" />
          ) : (
            <div className="flex flex-col gap-2">
              {invoices.map((inv) => (
                <TgCard key={inv.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-navy-900 text-sm">{inv.number}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {inv.clientName} · {new Date(inv.date).toLocaleDateString('ru-RU')}
                        {inv.dueDate && ` · срок ${new Date(inv.dueDate).toLocaleDateString('ru-RU')}`}
                      </div>
                    </div>
                    <Badge tone={INVOICE_TONE[inv.status]}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold tabular-nums text-navy-900">{formatMoney(inv.total)}</span>
                    <TgButton variant="secondary" disabled={busyId === inv.id} onClick={() => markPaid(inv)}>
                      {busyId === inv.id ? '...' : 'Отметить оплаченным'}
                    </TgButton>
                  </div>
                </TgCard>
              ))}
            </div>
          )}
        </>
      )}
    </TgShell>
  )
}
