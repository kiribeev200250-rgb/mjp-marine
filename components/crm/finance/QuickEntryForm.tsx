'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/crm/ui'
import { localDateStr } from '@/lib/crm/utils'
import { CategoryCombobox, type CategoryOption } from './CategoryCombobox'
import type { FinanceEntryType } from '@prisma/client'

const TYPE_LABELS: Record<FinanceEntryType, string> = {
  INCOME:  'Доход',
  EXPENSE: 'Расход',
  SALARY:  'Зарплата',
}

const PAYMENT_METHODS = ['Наличные', 'Карта', 'Перевод', 'Bizum']

const TODAY = localDateStr(new Date())

export interface QuickEntryResult {
  id:       string
  type:     FinanceEntryType
  category: string
  amount:   string
  date:     string
  autoId:   string
}

interface Props {
  onAdded?: (entry: QuickEntryResult) => void
  compact?: boolean
}

// Быстрый ввод операции: тип → категория (растёт на лету) → сумма → дата →
// оплата → Enter. После успешного добавления форма не закрывается — категория
// и сумма сбрасываются, фокус возвращается на категорию, чтобы бить операции
// подряд без лишних кликов. Дата и способ оплаты остаются («последние значения»).
export function QuickEntryForm({ onAdded, compact }: Props) {
  const router = useRouter()
  const [type,          setType]          = useState<FinanceEntryType>('INCOME')
  const [category,      setCategory]      = useState<CategoryOption | null>(null)
  const [amountExpr,    setAmountExpr]    = useState('')
  const [date,          setDate]          = useState(TODAY)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [description,   setDescription]   = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState(false)

  const categoryRef = useRef<HTMLInputElement>(null)
  const amountRef   = useRef<HTMLInputElement>(null)

  function focusAmount() {
    requestAnimationFrame(() => amountRef.current?.focus())
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!category) { setError('Укажите категорию'); categoryRef.current?.focus(); return }
    if (!amountExpr.trim()) { setError('Введите сумму'); return }

    setSaving(true); setError(null); setSuccess(false)
    const res = await fetch('/api/crm/finance', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, categoryId: category.id, amountExpr, date, paymentMethod, description }),
    })
    setSaving(false)

    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка')
      return
    }
    const entry = await res.json()
    onAdded?.({ id: entry.id, type: entry.type, category: entry.category, amount: entry.amount, date: entry.date, autoId: entry.autoId })

    setCategory(null)
    setAmountExpr('')
    setDescription('')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 1500)
    requestAnimationFrame(() => categoryRef.current?.focus())
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Type toggle */}
      <div className="flex rounded-control overflow-hidden border border-gray-200">
        {(Object.keys(TYPE_LABELS) as FinanceEntryType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setCategory(null) }}
            className={`flex-1 py-2 text-label font-semibold transition ${
              type === t
                ? t === 'INCOME'  ? 'bg-success text-white'
                : t === 'EXPENSE' ? 'bg-danger  text-white'
                :                   'bg-warning  text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label className="block text-label text-gray-500 uppercase tracking-wide">Категория</label>
        <CategoryCombobox
          ref={categoryRef}
          kind={type}
          value={category}
          onChange={setCategory}
          onConfirm={focusAmount}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-label text-gray-500 uppercase tracking-wide">Сумма (€) — можно выражение</label>
        <input
          ref={amountRef}
          type="text"
          inputMode="decimal"
          placeholder="168.23 или 250/2"
          value={amountExpr}
          onChange={(e) => setAmountExpr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() } }}
          className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Дата</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Способ оплаты</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          >
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {!compact && (
        <input
          type="text"
          placeholder="Описание (необязательно)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
        />
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
      )}
      {success && (
        <div className="bg-success/10 border border-success/30 rounded-control px-3 py-2 text-success text-label">Добавлено — можно вводить следующую</div>
      )}

      <Button type="submit" loading={saving} className="w-full justify-center">
        Добавить (Enter)
      </Button>
    </form>
  )
}
