'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, Button, Input, Select, PROJECT_WORK_TONE } from '@/components/crm/ui'
import { formatMoney, PAYMENT_METHODS, PROJECT_WORK_STATUS_LABELS, LANGUAGE_LABELS } from '@/lib/crm/utils'

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
  quoteId: string | null
  quoteNumber: string | null
  materials: { id: string; name: string; quantity: string; unitPrice: string; total: string }[]
}

interface Props {
  projectId: string
  works: WorkRow[]
  defaultIvaRate: string
  defaultIrpfRate: string
  defaultLanguage: string
}

const TRANSFERABLE = new Set(['PLANNED', 'DONE'])

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

export function ProjectWorksList({ projectId, works, defaultIvaRate, defaultIrpfRate, defaultLanguage }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [transferMode, setTransferMode] = useState<'invoice' | 'quote' | 'pdf' | null>(null)
  const [ivaRate, setIvaRate] = useState(defaultIvaRate)
  const [irpfRate, setIrpfRate] = useState(defaultIrpfRate)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [pdfPrices, setPdfPrices] = useState(true)
  const [pdfLang, setPdfLang] = useState(defaultLanguage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedWorks = works.filter((w) => selected.has(w.id))
  const selectedTotal = selectedWorks.reduce((s, w) => s + Number(w.laborCost) + Number(w.materialsTotal), 0)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const transferToInvoice = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/works/transfer-to-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workIds: Array.from(selected), ivaRate, irpfRate, paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      router.push(`/crm/invoices/${data.invoice.id}`)
    } finally {
      setSaving(false)
    }
  }

  const transferToQuote = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/works/transfer-to-quote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workIds: Array.from(selected), ivaRate }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      router.push(`/crm/invoices/quote/${data.quote.id}`)
    } finally {
      setSaving(false)
    }
  }

  const downloadPlanPdf = () => {
    const params = new URLSearchParams({ prices: pdfPrices ? '1' : '0', lang: pdfLang })
    if (selected.size > 0) params.set('workIds', Array.from(selected).join(','))
    window.open(`/api/crm/projects/${projectId}/plan-pdf?${params.toString()}`, '_blank')
  }

  const eligibleCount = works.filter((w) => TRANSFERABLE.has(w.status)).length

  return (
    <div className="space-y-3">
      {eligibleCount > 0 && (
        <div className="flex items-center justify-end">
          <Button size="sm" variant="secondary" onClick={() => setTransferMode(transferMode === 'pdf' ? null : 'pdf')}>
            📄 Скачать план работ (PDF)
          </Button>
        </div>
      )}

      {transferMode === 'pdf' && (
        <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-4 space-y-3">
          <p className="text-label text-gray-500">
            {selected.size > 0 ? `Выбранные работы (${selected.size})` : 'Все запланированные работы'} — не фискальный документ, только презентация плана.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <Select label="Язык документа" value={pdfLang} onChange={(e) => setPdfLang(e.target.value)}>
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </Select>
            <label className="flex items-center gap-2 text-body text-gray-900 cursor-pointer select-none self-end pb-2">
              <input type="checkbox" checked={pdfPrices} onChange={(e) => setPdfPrices(e.target.checked)} />
              Показывать цены
            </label>
          </div>
          <Button onClick={downloadPlanPdf}>Скачать PDF</Button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bg-navy-900 text-white rounded-card px-4 py-2.5 flex items-center gap-3">
          <span className="text-body font-medium">Выбрано: {selected.size} — {formatMoney(selectedTotal)}</span>
          <Button size="sm" variant="secondary" onClick={() => setTransferMode(transferMode === 'quote' ? null : 'quote')}>Перенести в пресмет</Button>
          <Button size="sm" onClick={() => setTransferMode(transferMode === 'invoice' ? null : 'invoice')}>Перенести в счёт</Button>
          <button onClick={() => { setSelected(new Set()); setTransferMode(null) }} className="ml-auto text-label text-white/60 hover:text-white transition">Снять выделение</button>
        </div>
      )}

      {transferMode === 'quote' && selected.size > 0 && (
        <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-4 space-y-3">
          <p className="text-label text-gray-500">
            Работы останутся в проекте — пресмет предварительный, можно будет пересобрать и отправить ещё раз.
          </p>
          <Input label="Ставка IVA, %" type="number" min={0} max={100} value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} className="max-w-xs" />
          {error && <p className="text-body text-danger">{error}</p>}
          <Button disabled={saving} onClick={transferToQuote}>{saving ? 'Формирую…' : `Создать пресмет (${selected.size})`}</Button>
        </div>
      )}

      {transferMode === 'invoice' && selected.size > 0 && (
        <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Ставка IVA, %" type="number" min={0} max={100} value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} />
            <Input label="Ставка IRPF, %" type="number" min={0} max={100} value={irpfRate} onChange={(e) => setIrpfRate(e.target.value)} />
            <Select label="Способ оплаты" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          {error && <p className="text-body text-danger">{error}</p>}
          <Button disabled={saving} onClick={transferToInvoice}>{saving ? 'Выставляю…' : `Выставить счёт (${selected.size})`}</Button>
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
                  {TRANSFERABLE.has(w.status) ? (
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
                      {w.quoteNumber && (
                        <Link href={`/crm/invoices/quote/${w.quoteId}`} className="text-label text-info hover:underline">📄 Пресмет {w.quoteNumber}</Link>
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
    </div>
  )
}
