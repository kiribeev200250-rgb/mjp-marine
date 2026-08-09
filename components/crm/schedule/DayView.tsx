'use client'

import Link from 'next/link'
import { localDateStr } from '@/lib/crm/utils'
import type { SerializedTask } from './types'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7..19

const STATUS_BG: Record<string, string> = {
  NEW:         'bg-gray-50  border-gray-200',
  SCHEDULED:   'bg-info/10  border-info/20',
  IN_PROGRESS: 'bg-warning/10 border-warning/20',
  DONE:        'bg-success/8  border-success/15',
  PROBLEM:     'bg-danger/10  border-danger/20',
}

interface Props {
  date:  Date
  tasks: SerializedTask[]
  today: string
}

export function DayView({ date, tasks, today }: Props) {
  const dateStr = localDateStr(date)
  const isToday = dateStr === today

  const dayTasks = tasks
    .filter((t) => t.scheduledAt?.slice(0, 10) === dateStr)
    .sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0
      if (!a.startTime) return 1
      if (!b.startTime) return -1
      return a.startTime.localeCompare(b.startTime)
    })

  // Group tasks by start hour (or put them in "no time" bucket)
  const tasksByHour: Record<number, SerializedTask[]> = {}
  const noTimeTasks: SerializedTask[] = []

  for (const t of dayTasks) {
    if (!t.startTime) { noTimeTasks.push(t); continue }
    const h = new Date(t.startTime).getUTCHours()
    tasksByHour[h] = [...(tasksByHour[h] ?? []), t]
  }

  const dateLabel = date.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Date header */}
      <div className={`px-4 py-3 border-b border-gray-200 ${isToday ? 'bg-gold/5' : ''}`}>
        <p className={`text-subheading font-semibold capitalize ${isToday ? 'text-gold' : 'text-gray-900'}`}>
          {dateLabel}
        </p>
        <p className="text-label text-gray-500 mt-0.5">{dayTasks.length} задач на этот день</p>
      </div>

      {/* No-time tasks */}
      {noTimeTasks.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/40">
          <p className="text-label text-gray-500 uppercase tracking-wide mb-2">Без времени</p>
          <div className="space-y-1.5">
            {noTimeTasks.map((t) => <TaskBlock key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {/* Hourly slots */}
      <div className="divide-y divide-gray-100">
        {HOURS.map((h) => {
          const slotTasks = tasksByHour[h] ?? []
          const isEmpty   = slotTasks.length === 0

          return (
            <div key={h} className={`flex min-h-[56px] ${isEmpty ? '' : 'bg-white'}`}>
              {/* Hour label */}
              <div className="w-14 shrink-0 flex items-start pt-2 px-3">
                <span className="text-[10px] text-gray-200 tabular-nums">{h}:00</span>
              </div>

              {/* Tasks in this slot */}
              <div className="flex-1 py-1.5 pr-3 space-y-1.5">
                {slotTasks.map((t) => <TaskBlock key={t.id} task={t} showTime />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskBlock({ task, showTime }: { task: SerializedTask; showTime?: boolean }) {
  const startFmt = task.startTime
    ? new Date(task.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : null
  const endFmt = task.endTime
    ? new Date(task.endTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : null

  return (
    <Link href={`/crm/schedule/${task.id}`}>
      <div className={`rounded-control border px-3 py-2 hover:shadow-e1 transition ${STATUS_BG[task.status] ?? 'bg-white border-gray-200'}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-body font-medium text-gray-900">{task.title}</p>
          {showTime && startFmt && (
            <span className="text-[10px] text-gray-500 tabular-nums shrink-0">
              {startFmt}{endFmt ? `–${endFmt}` : ''}
            </span>
          )}
        </div>
        {task.client && (
          <p className="text-label text-gray-500 mt-0.5">
            {task.client.firstName} {task.client.lastName}
            {task.marina ? ` · ${task.marina}` : ''}
          </p>
        )}
      </div>
    </Link>
  )
}