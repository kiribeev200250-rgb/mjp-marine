'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useRouter } from 'next/navigation'
import { WeekView }   from './WeekView'
import { MonthView }  from './MonthView'
import { DayView }    from './DayView'
import { BacklogPanel } from './BacklogPanel'
import { TaskCardDisplay } from './TaskCard'
import { localDateStr } from '@/lib/crm/utils'
import type { SerializedTask } from './types'

type View = 'week' | 'month' | 'day'

const MONTH_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getMonday(date: Date): Date {
  const d   = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

interface Props { initialTasks: SerializedTask[] }

export function SchedulerBoard({ initialTasks }: Props) {
  const router = useRouter()
  const [tasks,      setTasks]      = useState<SerializedTask[]>(initialTasks)
  const [view,       setView]       = useState<View>('week')
  const [weekStart,  setWeekStart]  = useState(() => getMonday(new Date()))
  const [monthYear,  setMonthYear]  = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const [dayDate,    setDayDate]    = useState(() => new Date())
  const [activeTask, setActiveTask] = useState<SerializedTask | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const todayStr = localDateStr(new Date())
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // ── Navigation ──────────────────────────────────────────────────────────
  function goToday() {
    const now = new Date()
    setWeekStart(getMonday(now))
    setMonthYear({ year: now.getFullYear(), month: now.getMonth() })
    setDayDate(now)
  }

  function navPrev() {
    if (view === 'week')  setWeekStart((ws) => addDays(ws, -7))
    if (view === 'month') setMonthYear(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
    if (view === 'day')   setDayDate((d) => addDays(d, -1))
  }

  function navNext() {
    if (view === 'week')  setWeekStart((ws) => addDays(ws, 7))
    if (view === 'month') setMonthYear(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
    if (view === 'day')   setDayDate((d) => addDays(d, 1))
  }

  function navLabel() {
    if (view === 'week') {
      const s  = weekDays[0], e = weekDays[6]
      const sm = s.toLocaleDateString('ru-RU', { month: 'short' })
      const em = e.toLocaleDateString('ru-RU', { month: 'short' })
      if (sm === em) return `${s.getDate()}–${e.getDate()} ${em} ${e.getFullYear()}`
      return `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${e.getFullYear()}`
    }
    if (view === 'month') return `${MONTH_RU[monthYear.month]} ${monthYear.year}`
    return dayDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function handleDayClick(dateStr: string) {
    setDayDate(new Date(dateStr + 'T12:00:00'))
    setView('day')
  }

  function handleAdd(dateStr: string) {
    router.push(`/crm/schedule/new?date=${dateStr}`)
  }

  // ── DnD ────────────────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === active.id) ?? null)
  }

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over) return

    const taskId    = active.id as string
    const droppedOn = over.id as string
    const task      = tasks.find((t) => t.id === taskId)
    if (!task) return

    let newScheduledAt: string | null = null
    let newIsBacklog = false

    if (droppedOn === 'backlog') {
      newIsBacklog = true
    } else if (droppedOn.startsWith('day-')) {
      newScheduledAt = `${droppedOn.slice(4)}T12:00:00.000Z`
    } else {
      return
    }

    const prev = tasks
    setTasks((ts) =>
      ts.map((t) => t.id === taskId ? { ...t, scheduledAt: newScheduledAt, isBacklog: newIsBacklog } : t),
    )
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newScheduledAt, isBacklog: newIsBacklog }),
      })
      if (!res.ok) throw new Error()
    } catch { setTasks(prev) }
  }, [tasks])

  const backlogTasks = tasks.filter((t) => !t.scheduledAt || t.isBacklog)

  // ── Render ──────────────────────────────────────────────────────────────
  const TABS: { id: View; label: string }[] = [
    { id: 'week',  label: 'Неделя' },
    { id: 'month', label: 'Месяц'  },
    { id: 'day',   label: 'День'   },
  ]

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col gap-0 min-h-0">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 shrink-0 pb-3">
          {/* Nav */}
          <button
            onClick={navPrev}
            className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 w-7 h-7 flex items-center justify-center rounded-control text-body transition shadow-e1"
          >←</button>
          <button
            onClick={goToday}
            className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 text-label px-3 py-1 rounded-control transition shadow-e1"
          >Сегодня</button>
          <span className="text-body text-gray-900 font-medium flex-1 text-center">{navLabel()}</span>
          <button
            onClick={navNext}
            className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 w-7 h-7 flex items-center justify-center rounded-control text-body transition shadow-e1"
          >→</button>

          {/* View tabs */}
          <div className="flex bg-gray-100 rounded-control p-0.5 ml-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`px-3 py-1 rounded-control text-label font-medium transition ${
                  view === t.id
                    ? 'bg-navy-900 text-white shadow-e1'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main layout ── */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* Calendar area */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-card border border-gray-200 shadow-e2 overflow-hidden">
            {view === 'week' && (
              <WeekView weekDays={weekDays} tasks={tasks} today={todayStr} onAdd={handleAdd} />
            )}
            {view === 'month' && (
              <MonthView
                year={monthYear.year}
                month={monthYear.month}
                tasks={tasks}
                today={todayStr}
                onDayClick={handleDayClick}
              />
            )}
            {view === 'day' && (
              <DayView date={dayDate} tasks={tasks} today={todayStr} />
            )}
          </div>

          {/* Backlog panel */}
          <BacklogPanel tasks={backlogTasks} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCardDisplay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}