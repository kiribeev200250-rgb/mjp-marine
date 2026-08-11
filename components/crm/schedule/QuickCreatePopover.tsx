'use client'

import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { Button } from '@/components/crm/ui'
import type { SerializedTask, ClientWithBoats } from './types'

interface Props {
  date:         string          // YYYY-MM-DD
  startMinutes: number | null   // minutes from midnight, or null for an untimed task
  anchor?:      { x: number; y: number }
  clients:      ClientWithBoats[]
  onClose:      () => void
  onCreated:    (task: SerializedTask) => void
}

const DURATIONS = [
  { value: 30,  label: '30 мин' },
  { value: 60,  label: '1 ч'    },
  { value: 90,  label: '1.5 ч'  },
  { value: 120, label: '2 ч'    },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function minToHHMM(min: number) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}` }

const dateFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })

export function QuickCreatePopover({ date, startMinutes, anchor, clients, onClose, onCreated }: Props) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [startTime,   setStartTime]   = useState(startMinutes !== null ? minToHHMM(startMinutes) : '')
  const [duration,    setDuration]    = useState(60)
  const [clientId,    setClientId]    = useState('')
  const [boatId,      setBoatId]      = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const boxRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!anchor || !boxRef.current) {
      setStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
      return
    }
    const { width, height } = boxRef.current.getBoundingClientRect()
    const pad = 12
    let left = anchor.x + 8
    let top  = anchor.y + 8
    if (left + width  > window.innerWidth  - pad) left = window.innerWidth  - width  - pad
    if (top  + height > window.innerHeight - pad) top  = window.innerHeight - height - pad
    left = Math.max(pad, left)
    top  = Math.max(pad, top)
    setStyle({ position: 'fixed', top, left })
  }, [anchor])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const boats = clients.find((c) => c.id === clientId)?.boats ?? []

  function pickClient(id: string) {
    setClientId(id)
    const b = clients.find((c) => c.id === id)?.boats ?? []
    if (!b.some((x) => x.id === boatId)) setBoatId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError(null)

    let startIso: string | null = null
    let endIso:   string | null = null
    if (startMinutes !== null && startTime) {
      startIso = `${date}T${startTime}:00.000Z`
      const [h, m] = startTime.split(':').map(Number)
      const endMin = h * 60 + m + duration
      endIso = `${date}T${minToHHMM(endMin)}:00.000Z`
    }

    try {
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), description, clientId: clientId || null, boatId: boatId || null,
          scheduledAt: `${date}T12:00:00.000Z`, startTime: startIso, endTime: endIso, isBacklog: false,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Ошибка сервера')
      const created = await res.json()
      onCreated(created)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={boxRef}
        style={style}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-card shadow-e4 border border-gray-200 w-80 p-4 space-y-3"
      >
        <p className="text-label text-gray-500 font-semibold uppercase tracking-wide capitalize">
          {dateFmt.format(new Date(date + 'T12:00:00'))}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название задачи"
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 placeholder:text-gray-500/60 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          />

          {startMinutes !== null && (
            <div className="flex gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
              />
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="rounded-control border border-gray-200 bg-white px-2 py-2 text-body text-gray-900 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
              >
                {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание / комментарий"
            rows={2}
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 placeholder:text-gray-500/60 shadow-e1 resize-none focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          />

          <div className="flex gap-2">
            <select
              value={clientId}
              onChange={(e) => pickClient(e.target.value)}
              className="flex-1 min-w-0 rounded-control border border-gray-200 bg-white px-2 py-2 text-body text-gray-900 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
            >
              <option value="">— без клиента —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
            {boats.length > 0 && (
              <select
                value={boatId}
                onChange={(e) => setBoatId(e.target.value)}
                className="flex-1 min-w-0 rounded-control border border-gray-200 bg-white px-2 py-2 text-body text-gray-900 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
              >
                <option value="">— без лодки —</option>
                {boats.map((b) => <option key={b.id} value={b.id}>⛵ {b.name || b.model || 'Без названия'}</option>)}
              </select>
            )}
          </div>

          {error && <p className="text-label text-danger">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={saving} size="sm">Создать</Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
