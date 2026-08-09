'use client'

import Link from 'next/link'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { localDateStr } from '@/lib/crm/utils'
import type { SerializedTask } from './types'

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8..18
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const STATUS_BG: Record<string, string> = {
  NEW:         'bg-gray-200 border-gray-300',
  SCHEDULED:   'bg-info/15 border-info/30',
  IN_PROGRESS: 'bg-warning/15 border-warning/30',
  DONE:        'bg-success/10 border-success/20',
  PROBLEM:     'bg-danger/15 border-danger/30',
}

// ── DraggableTaskBlock ─────────────────────────────────────────────────────
function DraggableTaskBlock({ task }: { task: SerializedTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task } })

  const startMin = task.startTime
    ? new Date(task.startTime).getUTCHours() * 60 + new Date(task.startTime).getUTCMinutes()
    : null
  const endMin = task.endTime
    ? new Date(task.endTime).getUTCHours() * 60 + new Date(task.endTime).getUTCMinutes()
    : null

  const timeStr = startMin !== null
    ? `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`
    : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className={`rounded-control border px-2 py-1.5 cursor-grab active:cursor-grabbing transition select-none ${STATUS_BG[task.status] ?? 'bg-gray-50 border-gray-200'}`}
    >
      <Link
        href={`/crm/schedule/${task.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <p className="text-body font-medium text-gray-900 truncate leading-tight">{task.title}</p>
        {task.client && (
          <p className="text-[10px] text-gray-500 truncate mt-0.5">
            {task.client.firstName} {task.client.lastName}
          </p>
        )}
        {timeStr && <p className="text-[10px] text-gray-200 mt-0.5">{timeStr}</p>}
      </Link>
    </div>
  )
}

// ── DroppableDay ───────────────────────────────────────────────────────────
function DroppableDay({
  date, tasks, today, onAdd,
}: {
  date: Date; tasks: SerializedTask[]; today: string; onAdd: (d: string) => void
}) {
  const dateStr  = localDateStr(date)
  const isToday  = dateStr === today
  const isPast   = dateStr < today
  const dayIdx   = (date.getDay() + 6) % 7
  const isWknd   = dayIdx >= 5

  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateStr}` })

  return (
    <div className="flex flex-col min-w-0">
      {/* Day header */}
      <div className={`flex flex-col items-center py-2 mb-1 rounded-lg ${isToday ? 'bg-gold/10' : ''}`}>
        <span className={`text-[10px] font-semibold ${isToday ? 'text-gold' : isWknd ? 'text-gray-200' : 'text-gray-500'}`}>
          {DAY_SHORT[dayIdx]}
        </span>
        <span className={`text-subheading font-bold ${isToday ? 'text-gold' : isPast ? 'text-gray-200' : isWknd ? 'text-gray-200' : 'text-gray-900'}`}>
          {date.getDate()}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-1.5 p-1 rounded-card border min-h-[400px] transition-colors ${
          isOver ? 'bg-info/5 border-info/30' : 'border-transparent'
        }`}
      >
        {tasks
          .slice()
          .sort((a, b) => {
            if (!a.startTime && !b.startTime) return 0
            if (!a.startTime) return 1
            if (!b.startTime) return -1
            return a.startTime.localeCompare(b.startTime)
          })
          .map((t) => <DraggableTaskBlock key={t.id} task={t} />)}

        <button
          onClick={() => onAdd(dateStr)}
          className="mt-auto text-gray-200 hover:text-gray-500 text-[10px] py-1 transition text-center"
        >
          + добавить
        </button>
      </div>
    </div>
  )
}

// ── WeekView ───────────────────────────────────────────────────────────────
interface Props {
  weekDays: Date[]
  tasks:    SerializedTask[]
  today:    string
  onAdd:    (d: string) => void
}

export function WeekView({ weekDays, tasks, today, onAdd }: Props) {
  function tasksForDay(dateStr: string) {
    return tasks.filter((t) => t.scheduledAt?.slice(0, 10) === dateStr)
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Time ruler */}
      <div className="w-10 shrink-0 flex flex-col pt-[52px]">
        {HOURS.map((h) => (
          <div key={h} className="flex-1 flex items-start justify-end pr-1.5">
            <span className="text-[10px] text-gray-200 tabular-nums">{h}:00</span>
          </div>
        ))}
      </div>

      {/* Horizontal lines + day columns */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none flex flex-col pt-[52px]">
          {HOURS.map((h) => (
            <div key={h} className="flex-1 border-t border-gray-200/40" />
          ))}
        </div>

        {/* 7 day columns */}
        <div className="relative grid grid-cols-7 gap-1.5 h-full">
          {weekDays.map((day) => (
            <DroppableDay
              key={localDateStr(day)}
              date={day}
              tasks={tasksForDay(localDateStr(day))}
              today={today}
              onAdd={onAdd}
            />
          ))}
        </div>
      </div>
    </div>
  )
}