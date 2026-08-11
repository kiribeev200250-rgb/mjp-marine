'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/crm/ui'

interface Props {
  taskId: string
  defaultTitle: string
}

// После выполненной работы — напоминание/лид на будущее («антифулинг через
// 12 мес»). Создаёт Reminder(SEASONAL_SERVICE) — в срок cron сам заведёт
// новую задачу-бэклог клиенту и уведомит владельца (см. cron/reminders).
export function SeasonalReminderPanel({ taskId, defaultTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [months, setMonths] = useState('12')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setSaving(true)
    const res = await fetch(`/api/crm/tasks/${taskId}/reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, monthsAhead: Number(months) }),
    })
    setSaving(false)
    if (res.ok) {
      setDone(true)
      setOpen(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Ошибка')
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
        <p className="text-body text-success">✓ Напоминание запланировано — через {months} мес. появится задача клиенту.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide">Напоминание о ТО</h2>
        {!open && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>+ Запланировать</Button>}
      </div>
      {open && (
        <div className="space-y-2">
          <Input label="Текст напоминания" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Через сколько месяцев" type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
          {error && <p className="text-body text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={submit}>{saving ? 'Сохраняю…' : 'Создать'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          </div>
        </div>
      )}
    </div>
  )
}
