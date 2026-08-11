'use client'

import type { SerializedTask } from './types'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const STATUS_DOT: Record<string, string> = {
  NEW:         'bg-gray-400',
  SCHEDULED:   'bg-info',
  IN_PROGRESS: 'bg-warning',
  DONE:        'bg-success',
  PROBLEM:     'bg-danger',
}

interface Props {
  year:      number
  month:     number      // 0-based
  tasks:     SerializedTask[]
  today:     string
  onDayClick:    (dateStr: string) => void
  onTaskClick:   (task: SerializedTask) => void
  onQuickCreate: (dateStr: string, startMinutes: number | null, anchor: { x: number; y: number }) => void
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function MonthView({ year, month, tasks, today, onDayClick, onTaskClick, onQuickCreate }: Props) {
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const tasksByDay: Record<string, SerializedTask[]> = {}
  for (const t of tasks) {
    if (!t.scheduledAt) continue
    const d = t.scheduledAt.slice(0, 10)
    tasksByDay[d] = [...(tasksByDay[d] ?? []), t]
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={`text-center py-2 text-label font-semibold uppercase tracking-wide ${
              i >= 5 ? 'text-gray-500' : 'text-gray-500'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-200 min-h-[96px]">
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} className="border-r border-gray-100 last:border-r-0 bg-gray-50/30" />
            }
            const dateStr   = toDateStr(year, month, day)
            const isToday   = dateStr === today
            const dayTasks  = tasksByDay[dateStr] ?? []
            const isWknd    = di >= 5

            return (
              <div
                key={di}
                onClick={(e) => onQuickCreate(dateStr, null, { x: e.clientX, y: e.clientY })}
                className={`border-r border-gray-100 last:border-r-0 p-1.5 text-left cursor-pointer hover:bg-gray-50 transition min-h-[96px] flex flex-col ${
                  isWknd ? 'bg-gray-50/40' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1 pointer-events-none">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDayClick(dateStr) }}
                    className={`pointer-events-auto w-6 h-6 flex items-center justify-center rounded-full text-label font-bold transition ${
                      isToday
                        ? 'bg-gold text-navy'
                        : isWknd ? 'text-gray-500 hover:bg-gray-100' : 'text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {day}
                  </button>
                  {dayTasks.length > 0 && (
                    <span className="text-label text-gray-500 tabular-nums">{dayTasks.length}</span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 flex-1">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(t) }}
                      className="flex items-center gap-1 min-w-0 rounded px-1 py-0.5 hover:bg-white transition cursor-pointer"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-400'}`} />
                      <span className="text-label text-gray-900 truncate leading-tight">{t.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDayClick(dateStr) }}
                      className="text-label text-gray-500 hover:text-gray-900 text-left px-1 transition"
                    >
                      +{dayTasks.length - 3} ещё
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
