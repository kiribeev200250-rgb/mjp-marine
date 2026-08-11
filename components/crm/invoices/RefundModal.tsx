'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/crm/ui'
import { formatMoney } from '@/lib/crm/utils'
import Decimal from 'decimal.js'

interface Props {
  invoiceId:     string
  invoiceNumber: string
  paidNet:       string // сколько сейчас реально зачтено нетто (после предыдущих возвратов, если были)
  ivaRate:       string
  onClose:       () => void
  onDone:        (cascade: string[]) => void
}

export function RefundModal({ invoiceId, invoiceNumber, paidNet, ivaRate, onClose, onDone }: Props) {
  const [amount,  setAmount]  = useState(paidNet)
  const [reason,  setReason]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const maxNet = new Decimal(paidNet)
  const rate   = new Decimal(ivaRate)
  let preview: { net: Decimal; iva: Decimal; gross: Decimal } | null = null
  try {
    const net = new Decimal(amount.replace(',', '.') || '0')
    if (net.gt(0)) {
      const iva = net.times(rate).div(100)
      preview = { net, iva, gross: net.plus(iva) }
    }
  } catch { /* некорректный ввод — превью просто не покажется */ }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    const res = await fetch(`/api/crm/invoices/${invoiceId}/refund`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount, reason: reason.trim() }),
    })
    setSaving(false)

    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка')
      return
    }
    const data = await res.json().catch(() => ({}))
    onDone(data.cascade ?? [])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-card shadow-e4 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-subheading font-bold text-gray-900">Возврат по счёту {invoiceNumber}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-body transition">✕</button>
        </div>
        <p className="text-label text-gray-500 mb-4">Оплачено (нетто) сейчас: {formatMoney(maxNet)}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Сумма возврата, € (нетто, без IVA)"
            type="text" inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <Input
            label="Причина (необязательно)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Клиент отказался от части работ..."
          />

          {preview && (
            <div className="bg-gray-50 border border-gray-200 rounded-control px-3 py-2 text-label text-gray-700 space-y-0.5">
              <p>Доход в P&L: −{formatMoney(preview.net)}</p>
              <p>IVA repercutido: −{formatMoney(preview.iva)}</p>
              <p className="font-semibold text-gray-900">Клиенту к возврату: {formatMoney(preview.gross)}</p>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
          )}

          <Button type="submit" variant="danger" loading={saving} className="w-full justify-center">
            Оформить возврат
          </Button>
        </form>
      </div>
    </div>
  )
}
