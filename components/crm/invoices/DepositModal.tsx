'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/crm/ui'
import { formatMoney } from '@/lib/crm/utils'
import Decimal from 'decimal.js'

interface Props {
  invoiceId:      string
  invoiceNumber:  string
  suggested:      string // подсказка — требуемый аванс по depositType/depositValue счёта, брутто, может быть '0'
  remainingGross: string // сколько ещё осталось получить по счёту всего, брутто
  ivaRate:        string
  onClose:        () => void
  onDone:         (cascade: string[]) => void
}

export function DepositModal({ invoiceId, invoiceNumber, suggested, remainingGross, ivaRate, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(suggested !== '0' ? suggested : '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const rate = new Decimal(ivaRate)
  let preview: { gross: Decimal; net: Decimal; iva: Decimal } | null = null
  try {
    const gross = new Decimal(amount.replace(',', '.') || '0')
    if (gross.gt(0)) {
      const net = gross.div(rate.div(100).plus(1)).toDecimalPlaces(2)
      preview = { gross, net, iva: gross.minus(net) }
    }
  } catch { /* некорректный ввод — превью просто не покажется */ }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    const res = await fetch(`/api/crm/invoices/${invoiceId}/deposit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount }),
    })
    setSaving(false)

    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка')
      return
    }
    const data = await res.json().catch(() => ({}))
    onDone(data.lines ?? [])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-card shadow-e4 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-subheading font-bold text-gray-900">Аванс по счёту {invoiceNumber}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-body transition">✕</button>
        </div>
        <p className="text-label text-gray-500 mb-4">Осталось получить по счёту: {formatMoney(new Decimal(remainingGross))}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Сумма аванса, € (брутто, с IVA — как её и вносит клиент)"
            type="text" inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />

          {preview && (
            <div className="bg-gray-50 border border-gray-200 rounded-control px-3 py-2 text-label text-gray-700 space-y-0.5">
              <p>Доход в P&L (нетто): +{formatMoney(preview.net)}</p>
              <p>IVA repercutido: +{formatMoney(preview.iva)}</p>
              <p className="font-semibold text-gray-900">Получено от клиента: {formatMoney(preview.gross)}</p>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
          )}

          <Button type="submit" loading={saving} className="w-full justify-center">
            Зафиксировать аванс
          </Button>
        </form>
      </div>
    </div>
  )
}
