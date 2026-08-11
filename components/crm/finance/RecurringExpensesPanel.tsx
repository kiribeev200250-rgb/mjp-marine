'use client'

import { useEffect, useState } from 'react'
import { Button, Card, SectionHeader, Input, Select, Badge } from '@/components/crm/ui'
import { CategoryCombobox, type CategoryOption } from './CategoryCombobox'
import { formatMoney, PAYMENT_METHODS } from '@/lib/crm/utils'
import type { RecurrenceFrequency } from '@prisma/client'

interface Template {
  id: string
  category: string
  amount: string
  paymentMethod: string
  description: string
  frequency: RecurrenceFrequency
  dayOfMonth: number
  monthOfYear: number | null
  active: boolean
}

interface Occurrence {
  id: string
  period: string
  dueDate: string
  recurringExpense: Template
}

const FREQ_LABEL: Record<RecurrenceFrequency, string> = {
  MONTHLY: 'Ежемесячно',
  WEEKLY: 'Еженедельно',
  YEARLY: 'Ежегодно',
}

const MONTH_LABEL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

export function RecurringExpensesPanel() {
  const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null)
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [category, setCategory] = useState<CategoryOption | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [monthOfYear, setMonthOfYear] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetch('/api/crm/finance/recurring/occurrences').then((r) => r.json()).then(setOccurrences)
    fetch('/api/crm/finance/recurring').then((r) => r.json()).then(setTemplates)
  }

  useEffect(load, [])

  const confirm = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/crm/finance/recurring/occurrences/${id}/confirm`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) load()
  }

  const skip = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/crm/finance/recurring/occurrences/${id}/skip`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) load()
  }

  const toggleActive = async (t: Template) => {
    setBusyId(t.id)
    const res = await fetch(`/api/crm/finance/recurring/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !t.active }),
    })
    setBusyId(null)
    if (res.ok) load()
  }

  const remove = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/crm/finance/recurring/${id}`, { method: 'DELETE' })
    setBusyId(null)
    if (res.ok) load()
  }

  const createTemplate = async () => {
    setError(null)
    if (!category) { setError('Укажите категорию'); return }
    if (!amount || Number(amount) <= 0) { setError('Укажите сумму'); return }
    setSaving(true)
    const res = await fetch('/api/crm/finance/recurring', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: category.name, categoryId: category.id, amount, paymentMethod, description,
        frequency, dayOfMonth: Number(dayOfMonth), monthOfYear: frequency === 'YEARLY' ? Number(monthOfYear) : undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      setCategory(null); setAmount(''); setDescription('')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Ошибка')
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Ожидают подтверждения в этом периоде" />
        {occurrences === null ? (
          <p className="text-body text-gray-500">Загрузка…</p>
        ) : occurrences.length === 0 ? (
          <p className="text-body text-gray-500 text-center py-4">Нечего подтверждать — всё проведено или ещё не наступило.</p>
        ) : (
          <div className="space-y-2">
            {occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-control border border-gray-200">
                <div className="min-w-0">
                  <p className="text-body text-gray-900 font-medium">{o.recurringExpense.category}</p>
                  <p className="text-label text-gray-500">
                    {FREQ_LABEL[o.recurringExpense.frequency]} · срок {fmtDate(o.dueDate)}
                    {o.recurringExpense.description && ` · ${o.recurringExpense.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-body font-semibold tabular-nums text-gray-900">{formatMoney(o.recurringExpense.amount)}</span>
                  <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => skip(o.id)}>Пропустить</Button>
                  <Button size="sm" disabled={busyId === o.id} onClick={() => confirm(o.id)}>Подтвердить</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Шаблоны"
          action={<Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Отменить' : '+ Новый шаблон'}</Button>}
        />

        {showForm && (
          <div className="mb-4 p-4 border border-gray-200 rounded-control space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-label text-gray-500 uppercase tracking-wide mb-1">Категория</label>
                <CategoryCombobox kind="EXPENSE" value={category} onChange={setCategory} placeholder="Категория расхода…" />
              </div>
              <Input label="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" suffix="€" />
              <Select label="Периодичность" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                <option value="MONTHLY">Ежемесячно</option>
                <option value="WEEKLY">Еженедельно</option>
                <option value="YEARLY">Ежегодно</option>
              </Select>
              <Select label="Способ оплаты" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              {frequency !== 'WEEKLY' && (
                <Input
                  label="День месяца" type="number" min={1} max={28} value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
              )}
              {frequency === 'YEARLY' && (
                <Select label="Месяц" value={monthOfYear} onChange={(e) => setMonthOfYear(e.target.value)}>
                  {MONTH_LABEL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </Select>
              )}
              <Input label="Примечание" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Необязательно" className="col-span-2" />
            </div>
            {error && <p className="text-body text-danger">{error}</p>}
            <Button disabled={saving} onClick={createTemplate}>{saving ? 'Сохраняю…' : 'Создать шаблон'}</Button>
          </div>
        )}

        {templates === null ? (
          <p className="text-body text-gray-500">Загрузка…</p>
        ) : templates.length === 0 ? (
          <p className="text-body text-gray-500 text-center py-4">Шаблонов пока нет</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2">
                  {!t.active && <Badge tone="neutral">Выключен</Badge>}
                  <div>
                    <p className="text-body text-gray-900 font-medium">{t.category}</p>
                    <p className="text-label text-gray-500">
                      {FREQ_LABEL[t.frequency]}
                      {t.frequency !== 'WEEKLY' && ` · день ${t.dayOfMonth}`}
                      {t.frequency === 'YEARLY' && t.monthOfYear && ` ${MONTH_LABEL[t.monthOfYear - 1]}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-body font-semibold tabular-nums text-gray-900">{formatMoney(t.amount)}</span>
                  <Button size="sm" variant="ghost" disabled={busyId === t.id} onClick={() => toggleActive(t)}>
                    {t.active ? 'Выключить' : 'Включить'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyId === t.id} onClick={() => remove(t.id)}>Удалить</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
