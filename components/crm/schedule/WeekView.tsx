'use client'

import { TimeGrid } from './TimeGrid'
import type { SerializedTask } from './types'

interface Props {
  weekDays: Date[]
  tasks:    SerializedTask[]
  today:    string
  onQuickCreate: (dateStr: string, startMinutes: number | null, anchor: { x: number; y: number }) => void
  onTaskClick:   (task: SerializedTask) => void
  onTaskPatch:   (id: string, patch: { scheduledAt?: string | null; startTime?: string | null; endTime?: string | null }) => void
}

export function WeekView({ weekDays, tasks, today, onQuickCreate, onTaskClick, onTaskPatch }: Props) {
  return (
    <TimeGrid
      days={weekDays}
      tasks={tasks}
      today={today}
      onQuickCreate={onQuickCreate}
      onTaskClick={onTaskClick}
      onTaskPatch={onTaskPatch}
    />
  )
}
