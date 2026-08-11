'use client'

import { TimeGrid } from './TimeGrid'
import type { SerializedTask } from './types'

interface Props {
  date:  Date
  tasks: SerializedTask[]
  today: string
  onQuickCreate: (dateStr: string, startMinutes: number | null, anchor: { x: number; y: number }) => void
  onTaskClick:   (task: SerializedTask) => void
  onTaskPatch:   (id: string, patch: { scheduledAt?: string | null; startTime?: string | null; endTime?: string | null }) => void
}

export function DayView({ date, tasks, today, onQuickCreate, onTaskClick, onTaskPatch }: Props) {
  const dateLabel = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isToday = date.toDateString() === new Date(today + 'T12:00:00').toDateString()

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`px-4 py-2 border-b border-gray-200 shrink-0 ${isToday ? 'bg-gold/5' : ''}`}>
        <p className={`text-subheading font-semibold capitalize ${isToday ? 'text-gold' : 'text-gray-900'}`}>{dateLabel}</p>
      </div>
      <TimeGrid
        days={[date]}
        tasks={tasks}
        today={today}
        onQuickCreate={onQuickCreate}
        onTaskClick={onTaskClick}
        onTaskPatch={onTaskPatch}
      />
    </div>
  )
}
