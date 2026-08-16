'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, Button, Input, Select, PROJECT_WORK_TONE } from '@/components/crm/ui'
import { formatMoney, PAYMENT_METHODS, PROJECT_WORK_STATUS_LABELS } from '@/lib/crm/utils'

export interface WorkRow {
  id: string
  title: string
  laborCost: string
  materialsTotal: string
  status: string
  scheduledAt: string | null
  taskId: string | null
  invoiceId: string | null
  invoiceNumber: string | null
  materials: { id: string; name: string; quantity: string; unitPrice: string; total: string }[]
}

interface Props {
  projectId: string
  works: WorkRow[]
  defaultIvaRate: string
  defaultIrpfRate: string
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

export function ProjectWorksList({ projectId, works, defaultIvaRate, defaultIrpfRate }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showTransfer, setShowTransfer] = useState(false)
  const [ivaRate, setIvaRate] = useState(defaultIvaRate)
  const [irpfRate, setIrpfRate] = useState(defaultIrpfRate)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planned = works.filter((w) => w.status === 'PLANNED')
  const selectedWorks = works.filter((w) => selected.has(w.id))
  const selectedTotal = selectedWorks.reduce((s, w) => s + Number(w.laborCost) + Number(w.materialsTotal), 0)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const transfer = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/works/transfer-to-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workIds: Array.from(selected), ivaRate, irpfRate, paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      router.push(`/crm/invoices/${data.invoice.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="bg-navy-900 text-white rounded-card px-4 py-2.5 flex items-center gap-3">
          <span className="text-body font-medium">Выбрано: {selected.size} — {formatMoney(selectedTotal)}</span>
          <Button size="sm" onClick={() => setShowTransfer((v) => !v)}>Перенести в счёт</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-label text-white/60 hover:text-white transition">Снять выделение</button>
        </div>
      )}

      {showTransfer && selected.size > 0 && (
        <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Ставка IVA, %" type="number" min={0} max={100} value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} />
            <Input label="Ставка IRPF, %" type="number" min={0} max={100} value={irpfRate} onChange={(e) => setIrpfRate(e.target.value)} />
            <Select label="Способ оплаты" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          {error && <p className="text-body text-danger">{error}</p>}
          <Button disabled={saving} onClick={transfer}>{saving ? 'Выставляю…' : `Выставить счёт (${selected.size})`}</Button>
        </div>
      )}

      {works.length === 0 ? (
        <p className="text-body text-gray-500 text-center py-8">Работ пока нет — добавьте первую</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-card shadow-e2 divide-y divide-gray-100">
          {works.map((w) => {
            const total = Number(w.laborCost) + Number(w.materialsTotal)
            return (
              <div key={w.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  {w.status === 'PLANNED' ? (
                    <input type="checkbox" className="mt-1" checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                  ) : (
                    <span className="w-4" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-body text-gray-900 font-medium">{w.title}</p>
                      <Badge tone={PROJECT_WORK_TONE[w.status] ?? 'neutral'}>{PROJECT_WORK_STATUS_LABELS[w.status] ?? w.status}</Badge>
                      {w.scheduledAt && (
                        w.taskId
                          ? <Link href={`/crm/schedule/${w.taskId}`} className="text-label text-info hover:underline">📅 {fmtDate(w.scheduledAt)}</Link>
                          : <span className="text-label text-gray-500">📅 {fmtDate(w.scheduledAt)}</span>
                      )}
                      {w.invoiceNumber && (
                        <Link href={`/crm/invoices/${w.invoiceId}`} className="text-label text-info hover:underline">→ Счёт {w.invoiceNumber}</Link>
                      )}
                    </div>
                    {w.materials.length > 0 && (
                      <ul className="mt-1 text-label text-gray-500">
                        {w.materials.map((m) => (
                          <li key={m.id}>· {m.name} ×{m.quantity} — {formatMoney(m.total)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-body font-semibold tabular-nums text-gray-900 shrink-0">{formatMoney(total)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {planned.length === 0 && works.length > 0 && (
        <p className="text-label text-gray-500">Все работы либо выполнены, либо уже в счетах.</p>
      )}
    </div>
  )
}
