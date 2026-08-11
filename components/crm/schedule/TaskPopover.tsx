'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Badge, TASK_TONE } from '@/components/crm/ui'
import { TASK_STATUS_LABELS } from '@/lib/crm/utils'
import { TaskForm } from './TaskForm'
import { QuickStatusPanel } from './QuickStatusPanel'
import type { SerializedTask, ClientWithBoats } from './types'

interface Props {
  task:      SerializedTask
  clients:   ClientWithBoats[]
  onClose:   () => void
  onChange:  (task: SerializedTask) => void
  onDeleted: (id: string) => void
}

export function TaskPopover({ task, clients, onClose, onChange, onDeleted }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-card shadow-e4 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-subheading font-bold text-gray-900 truncate">{task.title}</h2>
            <Badge tone={TASK_TONE[task.status] ?? 'neutral'} className="shrink-0">
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/crm/schedule/${task.id}`} className="text-label text-gold hover:underline">
              Открыть полностью →
            </Link>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-body transition">✕</button>
          </div>
        </div>

        {(task.client || task.boat) && (
          <div className="flex flex-wrap gap-3 mb-5 text-label">
            {task.client && (
              <Link href={`/crm/clients/${task.clientId}`} className="text-gold hover:underline">
                👤 {task.client.firstName} {task.client.lastName}
              </Link>
            )}
            {task.boat && task.clientId && (
              <Link href={`/crm/clients/${task.clientId}/boats/${task.boat.id}`} className="text-gold hover:underline">
                ⛵ {task.boat.name || task.boat.model || 'Без названия'}
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TaskForm
              key={`${task.id}-${task.status}-${task.startTime}-${task.endTime}-${task.boatId}`}
              task={task}
              clients={clients}
              onSaved={(updated) => { onChange(updated); onClose() }}
              onDeleted={() => { onDeleted(task.id); onClose() }}
            />
          </div>
          <div>
            <QuickStatusPanel taskId={task.id} current={task.status} onChange={(updated) => onChange(updated as unknown as SerializedTask)} />
          </div>
        </div>
      </div>
    </div>
  )
}
