'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Select } from '@/components/crm/ui'
import { localDateStr } from '@/lib/crm/utils'
import type { CapitalEntryType } from '@prisma/client'

const TYPE_LABELS: Record<CapitalEntryType, string> = {
  REINVESTMENT:  'Доинвестиция (в кассу)',
  STARTUP_ASSET: 'Стартовые — актив (не в кассу)',
  STARTUP_SUNK:  'Стартовые невозвратные (не в кассу)',
}

interface Props {
  onClose: () => void
}

export function CapitalEntryModal({ onClose }: Props) {
  const router = useRouter()
  const [type,   setType]   = useState<CapitalEntryType>('REINVESTMENT')
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [date,   setDate]   = useState(localDateStr(new Date()))
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount.trim()) { setError('Введите сумму'); return }
    setSaving(true); setError(null)

    const res = await fetch('/api/crm/capital', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, amount, source, date, note }),
    })
    setSaving(false)

    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка')
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-card shadow-e4 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-subheading font-bold text-gray-900">Вложение капитала</h2>
          <button onClick={onClose} className="text-gray-200 hover:text-gray-500 text-body transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Select label="Тип" value={type} onChange={(e) => setType(e.target.value as CapitalEntryType)}>
            {(Object.keys(TYPE_LABELS) as CapitalEntryType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </Select>
          <Input label="Сумма (€)" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" autoFocus />
          <Input label="Источник / назначение" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Личные средства, кредит..." />
          <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Примечание" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необязательно" />

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
          )}

          <Button type="submit" loading={saving} className="w-full justify-center">Добавить</Button>
        </form>
      </div>
    </div>
  )
}
