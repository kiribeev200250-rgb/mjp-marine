'use client'

import Link from 'next/link'
import { useDroppable } from '@dnd-kit/core'
import { TaskCard } from './TaskCard'
import type { SerializedTask } from './types'

interface Props { tasks: SerializedTask[]; onTaskClick: (task: SerializedTask) => void }

export function BacklogPanel({ tasks, onTaskClick }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: 'backlog' })

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
        <Link href="/crm/schedule/new" className="text-gold hover:text-gold-dark text-label transition">
          + задача
        </Link>
      </div>

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