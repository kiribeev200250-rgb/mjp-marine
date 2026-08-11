'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge, TASK_TONE } from '@/components/crm/ui'
import { TASK_STATUS_LABELS } from '@/lib/crm/utils'
import type { SerializedTask } from './types'

interface Props { task: SerializedTask; compact?: boolean; onClick: () => void }

export function TaskCardDisplay({ task, compact }: { task: SerializedTask; compact?: boolean }) {
  const time = task.startTime
    ? new Date(task.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : null

  return (
    <div className={`bg-white border border-gray-200 rounded-card shadow-e1 ${compact ? 'p-2' : 'p-3'} cursor-grab hover:shadow-e2 hover:border-gray-300 transition`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-gray-900 font-medium truncate ${compact ? 'text-label' : 'text-body'}`}>
            {task.title}
          </p>
          {!compact && task.client && (
            <p className="text-gray-500 text-label truncate mt-0.5">
              {task.client.firstName} {task.client.lastName}
              {task.boat && ` · ⛵ ${task.boat.name || task.boat.model || ''}`}
            </p>
          )}
          {!compact && (task.marina || time) && (
            <div className="flex gap-2 mt-1">
              {task.marina && <span className="text-gray-500 text-label">⚓ {task.marina}</span>}
              {time        && <span className="text-gray-500 text-label">🕐 {time}</span>}
            </div>
          )}
        </div>
        {!compact && (
          <Badge tone={TASK_TONE[task.status] ?? 'neutral'} className="shrink-0">
            {TASK_STATUS_LABELS[task.status] ?? task.status}
          </Badge>
        )}
      </div>
    </div>
  )
}

export function TaskCard({ task, compact, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id, data: { task },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <TaskCardDisplay task={task} compact={compact} />
    </div>
  )
}
