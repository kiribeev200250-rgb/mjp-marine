'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/crm/ui'
import type { StockMovementType } from '@prisma/client'

interface Props {
  itemId:    string
  itemName:  string
  unit:      string
  defaultType?: StockMovementType
  onClose:   () => void
}

const TYPE_LABELS: Record<StockMovementType, string> = {
  RECEIVE:  'Приход (поступление)',
  WRITE_OFF:'Списание в работу',
  SELL:     'Продажа',
  ADJUST:   'Корректировка остатка',
  ORDER:    'Заказано (в пути)',
}

export function MovementModal({ itemId, itemName, unit, defaultType = 'RECEIVE', onClose }: Props) {
  const router = useRouter()
  const [type,      setType]      = useState<StockMovementType>(defaultType)
  const [qty,       setQty]       = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qtyNum = parseFloat(qty)
    if (isNaN(qtyNum) || (type !== 'ADJUST' && qtyNum <= 0)) {
      setError('Введите корректное количество')
      return
    }
    setSaving(true); setError(null)

    const res = await fetch(`/api/crm/inventory/${itemId}/movement`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, qty: qtyNum, unitPrice: parseFloat(unitPrice) || 0, note }),
    })

    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-card shadow-e4 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-subheading font-bold text-gray-900">Движение товара</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-body transition">✕</button>
        </div>

        <p className="text-body text-gray-500 mb-5 truncate">{itemName}</p>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-body mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-label text-gray-500 uppercase tracking-wide">Тип движения</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_LABELS) as StockMovementType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-2 rounded-control border text-label text-left transition ${
                    type === t
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-gray-900 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={type === 'ADJUST' ? `Новый остаток (${unit})` : `Количество (${unit})`}
            type="number"
            step="0.001"
            min={type === 'ADJUST' ? '0' : '0.001'}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
          />

          {(type === 'RECEIVE' || type === 'SELL') && (
            <Input
              label="Цена за единицу (€)"
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          )}

          <Input label="Заметка" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Задача, накладная…" />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>Сохранить</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          </div>
        </form>
      </div>
    </div>
  )
}