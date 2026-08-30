'use client'

import { useState } from 'react'
import { Input, Select, Button, Badge } from '@/components/crm/ui'

interface Lock {
  id:        string
  label:     string
  startDate: string
  endDate:   string
  closedAt:  string
  closedBy:  { name: string } | null
}

interface Props {
  locks: Lock[]
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export function PeriodLocksSection({ locks: initial }: Props) {
  const [locks,    setLocks]   = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [unit,     setUnit]     = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH')
  const [busyId,   setBusyId]   = useState<string | null>(null)

  const now = new Date()

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      unit,
      year: Number(form.get('year')),
    }
    if (unit === 'MONTH')   body.month   = Number(form.get('month'))
    if (unit === 'QUARTER') body.quarter = Number(form.get('quarter'))

    const res = await fetch('/api/crm/periods', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    setSaving(false)
    if (res.ok) {
      const created = await res.json()
      setLocks((prev) => [{ ...created, closedBy: null }, ...prev])
      setShowForm(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Ошибка закрытия периода')
    }
  }

  async function handleReopen(id: string) {
    if (!confirm('Открыть период обратно? Операции внутри снова станут доступны для правки.')) return
    setBusyId(id)
    const res = await fetch(`/api/crm/periods/${id}`, { method: 'DELETE' })
    setBusyId(null)
    if (res.ok) setLocks((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
      {locks.length === 0 ? (
        <p className="text-body text-gray-500 text-center py-8">Закрытых периодов нет</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Период</th>
              <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Закрыт</th>
              <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Кем</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {locks.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 last:border-0">
                <td className="px-5 py-3">
                  <Badge tone="danger">🔒 {l.label}</Badge>
                </td>
                <td className="text-gray-500 px-5 py-3 tabular-nums">{fmtDate(l.closedAt)}</td>
                <td className="text-gray-500 px-5 py-3">{l.closedBy?.name ?? '—'}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleReopen(l.id)}
                    disabled={busyId === l.id}
                    className="text-label text-gray-500 hover:text-danger transition disabled:opacity-50"
                  >
                    {busyId === l.id ? '...' : 'Открыть обратно'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/50">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-gold-dark hover:text-gold text-sm font-medium transition"
          >
            + Закрыть период
          </button>
        ) : (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
              <option value="MONTH">Месяц</option>
              <option value="QUARTER">Квартал</option>
              <option value="YEAR">Год</option>
            </Select>

            {unit === 'MONTH' && (
              <Select name="month" defaultValue={String(now.getMonth() + 1)}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            )}
            {unit === 'QUARTER' && (
              <Select name="quarter" defaultValue={String(Math.ceil((now.getMonth() + 1) / 3))}>
                <option value="1">1 квартал</option>
                <option value="2">2 квартал</option>
                <option value="3">3 квартал</option>
                <option value="4">4 квартал</option>
              </Select>
            )}

            <Input name="year" type="number" required defaultValue={now.getFullYear()} />

            {error && <p className="sm:col-span-4 text-danger text-label">{error}</p>}

            <div className="sm:col-span-4 flex gap-3 items-center">
              <Button type="submit" loading={saving}>Закрыть</Button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="text-gray-500 hover:text-gray-900 text-sm transition"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
