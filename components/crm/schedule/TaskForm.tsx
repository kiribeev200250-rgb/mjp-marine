'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Select, Textarea, Button } from '@/components/crm/ui'
import type { SerializedTask, ClientWithBoats } from './types'

interface Props {
  task?: SerializedTask
  clients: ClientWithBoats[]
  defaultDate?: string
  defaultClientId?: string
  defaultBoatId?: string
  onSaved?: (task: SerializedTask) => void
  onDeleted?: () => void
}

const STATUS_OPTIONS = [
  { value: 'NEW',         label: 'Новая'         },
  { value: 'SCHEDULED',   label: 'Запланирована'  },
  { value: 'IN_PROGRESS', label: 'В работе'      },
  { value: 'DONE',        label: 'Выполнена'     },
  { value: 'PROBLEM',     label: 'Проблема'      },
]

export function TaskForm({ task, clients, defaultDate, defaultClientId, defaultBoatId, onSaved, onDeleted }: Props) {
  const router = useRouter()
  const isEdit = !!task

  const [form, setForm] = useState({
    title:       task?.title       ?? '',
    description: task?.description ?? '',
    clientId:    task?.clientId    ?? defaultClientId ?? '',
    boatId:      task?.boatId      ?? defaultBoatId    ?? '',
    marina:      task?.marina      ?? '',
    status:      task?.status      ?? 'NEW',
    scheduledAt: task?.scheduledAt ? task.scheduledAt.slice(0, 10) : (defaultDate ?? ''),
    startTime:   task?.startTime ? task.startTime.slice(11, 16) : '',
    endTime:     task?.endTime   ? task.endTime.slice(11, 16)   : '',
    isWarranty:     task?.isWarranty     ?? false,
    reworkOfTaskId: task?.reworkOfTaskId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [clientTasks, setClientTasks] = useState<{ id: string; title: string }[]>([])

  // Список других задач этого клиента — источник для «исходная работа» при
  // отметке «гарантия/переделка». Подгружаем только когда реально нужно —
  // клиент выбран и стоит галка гарантии.
  useEffect(() => {
    if (!form.clientId || !form.isWarranty) { setClientTasks([]); return }
    fetch(`/api/crm/tasks?clientId=${form.clientId}`)
      .then((r) => r.json())
      .then((rows: SerializedTask[]) => setClientTasks(rows.filter((t) => t.id !== task?.id).map((t) => ({ id: t.id, title: t.title }))))
      .catch(() => setClientTasks([]))
  }, [form.clientId, form.isWarranty, task?.id])

  function set(key: string, value: string) { setForm((p) => ({ ...p, [key]: value })) }

  function setClient(clientId: string) {
    const boats = clients.find((c) => c.id === clientId)?.boats ?? []
    setForm((p) => ({ ...p, clientId, boatId: boats.some((b) => b.id === p.boatId) ? p.boatId : '' }))
  }

  const selectedBoats = clients.find((c) => c.id === form.clientId)?.boats ?? []

  function buildDatetime(date: string, time: string): string | null {
    if (!date) return null
    return `${date}T${time || '12:00'}:00.000Z`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError(null)

    const body = {
      title: form.title.trim(), description: form.description,
      clientId: form.clientId || null, boatId: form.boatId || null,
      marina: form.marina, status: form.status,
      scheduledAt: buildDatetime(form.scheduledAt, ''),
      startTime:   buildDatetime(form.scheduledAt, form.startTime),
      endTime:     buildDatetime(form.scheduledAt, form.endTime),
      isWarranty:     form.isWarranty,
      reworkOfTaskId: form.isWarranty ? (form.reworkOfTaskId || null) : null,
      ...(isEdit && { version: task!.version }),
    }

    try {
      const res = await fetch(isEdit ? `/api/crm/tasks/${task!.id}` : '/api/crm/tasks', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Ошибка сервера')
      const saved = await res.json()
      if (onSaved) { onSaved(saved); return }
      router.push('/crm/schedule'); router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!task || !confirm('Удалить задачу?')) return
    setSaving(true)
    await fetch(`/api/crm/tasks/${task.id}`, { method: 'DELETE' })
    setSaving(false)
    if (onDeleted) { onDeleted(); return }
    router.push('/crm/schedule'); router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-control px-4 py-3 text-danger text-body">
          {error}
        </div>
      )}

      <Input
        label="Название задачи *"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        placeholder="Ремонт двигателя, осмотр корпуса..."
        autoFocus
      />

      <Textarea
        label="Описание / заметки"
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        rows={3}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select label="Клиент" value={form.clientId} onChange={(e) => setClient(e.target.value)}>
          <option value="">— без клиента —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </Select>
        {selectedBoats.length > 0 && (
          <Select label="Лодка" value={form.boatId} onChange={(e) => set('boatId', e.target.value)}>
            <option value="">— без лодки —</option>
            {selectedBoats.map((b) => (
              <option key={b.id} value={b.id}>⛵ {b.name || b.model || 'Без названия'}</option>
            ))}
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Марина" value={form.marina} onChange={(e) => set('marina', e.target.value)} placeholder="Puerto Blanco..." />
        <Select label="Статус" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      <Input label="Дата" type="date" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} />

      {form.scheduledAt && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Начало" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
          <Input label="Конец"  type="time" value={form.endTime}   onChange={(e) => set('endTime',   e.target.value)} />
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-body text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isWarranty}
            onChange={(e) => setForm((p) => ({ ...p, isWarranty: e.target.checked, reworkOfTaskId: e.target.checked ? p.reworkOfTaskId : '' }))}
            className="rounded border-gray-300"
          />
          Гарантия / переделка — без нового дохода клиенту, себестоимость учитывается
        </label>
        {form.isWarranty && clientTasks.length > 0 && (
          <Select label="Исходная работа (необязательно)" value={form.reworkOfTaskId} onChange={(e) => set('reworkOfTaskId', e.target.value)}>
            <option value="">— не указана —</option>
            {clientTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={saving}>
          {isEdit ? 'Сохранить' : 'Создать задачу'}
        </Button>
        {!onSaved && (
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Отмена
          </Button>
        )}
        {isEdit && (
          <Button type="button" variant="danger" onClick={handleDelete} disabled={saving} className="ml-auto">
            Удалить
          </Button>
        )}
      </div>
    </form>
  )
}
