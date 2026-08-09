'use client'

import type { SerializedTask } from './types'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const STATUS_DOT: Record<string, string> = {
  NEW:         'bg-gray-200',
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
  onDayClick: (dateStr: string) => void
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function MonthView({ year, month, tasks, today, onDayClick }: Props) {
  // First day of month
  const firstDay = new Date(year, month, 1)
  // Weekday of first day (0=Sun…6=Sat → convert to Mon-based)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build grid cells (leading empty + days + trailing empty)
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null)

  // Task index by day
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
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={`text-center py-2 text-label font-semibold uppercase tracking-wide ${
              i >= 5 ? 'text-gray-200' : 'text-gray-500'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-200 min-h-[90px]">
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} className="border-r border-gray-100 last:border-r-0 bg-gray-50/30" />
            }
            const dateStr   = toDateStr(year, month, day)
            const isToday   = dateStr === today
            const dayTasks  = tasksByDay[dateStr] ?? []
            const isWknd    = di >= 5

            return (
              <button
                key={di}
                onClick={() => onDayClick(dateStr)}
                className={`border-r border-gray-100 last:border-r-0 p-1.5 text-left hover:bg-gray-50 transition min-h-[90px] flex flex-col ${
                  isWknd ? 'bg-gray-50/40' : ''
                }`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-label font-bold ${
                      isToday
                        ? 'bg-gold text-navy'
                        : isWknd ? 'text-gray-200' : 'text-gray-900'
                    }`}
                  >
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] text-gray-500 tabular-nums">{dayTasks.length}</span>
                  )}
                </div>

                {/* Task dots (up to 3) */}
                <div className="flex flex-col gap-0.5 flex-1">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center gap-1 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-200'}`} />
                      <span className="text-[10px] text-gray-900 truncate leading-tight">{t.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-gray-200">+{dayTasks.length - 3} ещё</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}