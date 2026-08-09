'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/crm/ui'
import { localDateStr } from '@/lib/crm/utils'
import type { FinanceEntryType } from '@prisma/client'

const CATEGORIES: Record<FinanceEntryType, string[]> = {
  INCOME:  ['Ремонт яхты', 'Техобслуживание', 'Запчасти', 'Консультация', 'Прочий доход'],
  EXPENSE: ['Запчасти', 'Расходники', 'Топливо', 'Аренда', 'Связь', 'Реклама', 'Офис', 'Прочий расход'],
  SALARY:  ['Зарплата Иван', 'Зарплата Мария', 'Аванс', 'Премия'],
}

const TYPE_LABELS: Record<FinanceEntryType, string> = {
  INCOME:  'Доход',
  EXPENSE: 'Расход',
  SALARY:  'Зарплата',
}

const PAYMENT_METHODS = ['Нал', 'Карта', 'Перевод', 'Bizum']

const TODAY = localDateStr(new Date())

export function TransactionForm() {
  const router = useRouter()
  const [type,          setType]          = useState<FinanceEntryType>('INCOME')
  const [category,      setCategory]      = useState('')
  const [customCat,     setCustomCat]     = useState('')
  const [amountExpr,    setAmountExpr]    = useState('')
  const [date,          setDate]          = useState(TODAY)
  const [paymentMethod, setPaymentMethod] = useState('Нал')
  const [description,   setDescription]  = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState(false)

  const effectiveCategory = category === '__custom__' ? customCat : category

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!effectiveCategory.trim()) { setError('Укажите категорию'); return }
    if (!amountExpr.trim())        { setError('Введите сумму');      return }

    setSaving(true); setError(null); setSuccess(false)
    const res = await fetch('/api/crm/finance', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, category: effectiveCategory, amountExpr, date, paymentMethod, description }),
    })
    setSaving(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка')
      return
    }
    setAmountExpr(''); setDescription(''); setSuccess(true)
    setTimeout(() => setSuccess(false), 2500)
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
            onClick={() => { setType(t); setCategory('') }}
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

      {/* Category */}
      <div className="space-y-1">
        <label className="block text-label text-gray-500 uppercase tracking-wide">Категория</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
        >
          <option value="">— выбрать —</option>
          {CATEGORIES[type].map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__custom__">+ своя категория</option>
        </select>
        {category === '__custom__' && (
          <Input
            placeholder="Введите категорию"
            value={customCat}
            onChange={(e) => setCustomCat(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {/* Amount — supports expressions */}
      <div className="space-y-1">
        <label className="block text-label text-gray-500 uppercase tracking-wide">Сумма (€) — можно выражение</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="168.23 или 250/2"
          value={amountExpr}
          onChange={(e) => setAmountExpr(e.target.value)}
          className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

      <Input
        label="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Номер задачи, клиент, накладная…"
      />

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
      )}
      {success && (
        <div className="bg-success/10 border border-success/30 rounded-control px-3 py-2 text-success text-label">Запись добавлена</div>
      )}

      <Button type="submit" loading={saving} className="w-full justify-center">
        Добавить транзакцию
      </Button>
    </form>
  )
}