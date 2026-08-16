'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDroppable } from '@dnd-kit/core'
import { Badge, Button, Select, TASK_TONE } from '@/components/crm/ui'
import { TASK_STATUS_LABELS } from '@/lib/crm/utils'
import { TaskCard } from './TaskCard'
import type { SerializedTask } from './types'

interface Props {
  tasks: SerializedTask[]
  onTaskClick: (task: SerializedTask) => void
  onBulkApplied: (ids: string[], patch: Partial<SerializedTask>) => void
}

const STATUS_OPTIONS: SerializedTask['status'][] = ['NEW', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'PROBLEM', 'CANCELLED_BY_CLIENT']

export function BacklogPanel({ tasks, onTaskClick, onBulkApplied }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: 'backlog' })
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [bulkStatus, setBulkStatus] = useState<SerializedTask['status']>('SCHEDULED')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const exitBulkMode = () => {
    setBulkMode(false)
    setSelected(new Set())
    setError(null)
  }

  const applyBulk = async (patch: { scheduledAt?: string | null; isBacklog?: boolean; status?: string }) => {
    if (selected.size === 0) return
    setError(null)
    setBusy(true)
    const ids = Array.from(selected)
    try {
      const res = await fetch('/api/crm/tasks/bulk', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, patch }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      onBulkApplied(data.updatedIds, patch)
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  const reschedule = () => {
    if (!rescheduleDate) return
    void applyBulk({ scheduledAt: `${rescheduleDate}T12:00:00.000Z`, isBacklog: false })
  }

  const changeStatus = () => {
    void applyBulk({ status: bulkStatus })
  }

  return (
    <div className="w-64 flex flex-col bg-white rounded-card border border-gray-200 shadow-e2 overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-label text-gray-500 font-semibold uppercase tracking-wide">Backlog</span>
          {tasks.length > 0 && (
            <span className="bg-warning/10 text-warning text-label font-bold px-1.5 py-0.5 rounded-chip">
              {tasks.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <button onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))} className="text-gray-500 hover:text-gray-900 text-label transition">
              {bulkMode ? 'Готово' : 'Выбрать'}
            </button>
          )}
          {!bulkMode && (
            <Link href="/crm/schedule/new" className="text-gold hover:text-gold-dark text-label transition">
              + задача
            </Link>
          )}
        </div>
      </div>

      {bulkMode && selected.size > 0 && (
        <div className="px-3 py-2.5 border-b border-gray-200 bg-gray-50 space-y-2">
          <p className="text-label text-gray-500">Выбрано: {selected.size}</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="flex-1 min-w-0 rounded-control border border-gray-200 px-2 py-1 text-label text-gray-900"
            />
            <Button size="sm" disabled={busy || !rescheduleDate} onClick={reschedule}>Перенести</Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="flex-1 min-w-0">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </Select>
            <Button size="sm" variant="secondary" disabled={busy} onClick={changeStatus}>Статус</Button>
          </div>
          {error && <p className="text-label text-danger">{error}</p>}
        </div>
      )}

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-[200px] transition-colors ${
          isOver ? 'bg-gold/5' : ''
        }`}
      >
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
            <span className="text-success text-2xl">✓</span>
            <p className="text-gray-500 text-label text-center">Все задачи запланированы</p>
          </div>
        ) : bulkMode ? (
          tasks.map((task) => (
            <label
              key={task.id}
              className="flex items-start gap-2 bg-white border border-gray-200 rounded-card shadow-e1 p-2 cursor-pointer hover:border-gray-300 transition"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(task.id)}
                onChange={() => toggle(task.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-label text-gray-900 font-medium truncate">{task.title}</p>
                <Badge tone={TASK_TONE[task.status] ?? 'neutral'} className="mt-1">
                  {TASK_STATUS_LABELS[task.status] ?? task.status}
                </Badge>
              </div>
            </label>
          ))
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />)
        )}

        {isOver && (
          <div className="border border-dashed border-gold/40 rounded-control py-3 text-center text-gold/60 text-label">
            Перенести в backlog
          </div>
        )}
      </div>
    </div>
  )
}
