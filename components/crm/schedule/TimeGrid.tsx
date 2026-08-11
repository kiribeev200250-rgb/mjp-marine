'use client'

import { useEffect, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { localDateStr } from '@/lib/crm/utils'
import type { SerializedTask } from './types'

const GRID_START_HOUR = 7
const GRID_END_HOUR   = 21 // exclusive
const PX_PER_HOUR     = 56
const PX_PER_MIN      = PX_PER_HOUR / 60
const SNAP_MIN        = 15
const MIN_BLOCK_MIN   = 15
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => i + GRID_START_HOUR)
const TOTAL_MIN = (GRID_END_HOUR - GRID_START_HOUR) * 60

const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const STATUS_BG: Record<string, string> = {
  NEW:         'bg-gray-50  border-gray-300',
  SCHEDULED:   'bg-info/10  border-info/40',
  IN_PROGRESS: 'bg-warning/10 border-warning/40',
  DONE:        'bg-success/10 border-success/40',
  PROBLEM:     'bg-danger/10  border-danger/40',
}
const STATUS_DOT: Record<string, string> = {
  NEW:         'bg-gray-400',
  SCHEDULED:   'bg-info',
  IN_PROGRESS: 'bg-warning',
  DONE:        'bg-success',
  PROBLEM:     'bg-danger',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function minToHHMM(min: number) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}` }
function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)) }
function snap(n: number) { return Math.round(n / SNAP_MIN) * SNAP_MIN }

function startMinutesOf(t: SerializedTask): number {
  const d = new Date(t.startTime!)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}
function endMinutesOf(t: SerializedTask): number {
  if (t.endTime) {
    const d = new Date(t.endTime)
    const m = d.getUTCHours() * 60 + d.getUTCMinutes()
    return m > startMinutesOf(t) ? m : startMinutesOf(t) + 60
  }
  return startMinutesOf(t) + 60
}

interface DragState {
  taskId:    string
  mode:      'move' | 'resize'
  startClientX: number
  startClientY: number
  origDayIdx:   number
  origStartMin: number
  origEndMin:   number
  moved:     boolean
  dayIdx:    number
  startMin:  number
  endMin:    number
}

interface Props {
  days:          Date[]
  tasks:         SerializedTask[]
  today:         string
  onQuickCreate: (dateStr: string, startMinutes: number | null, anchor: { x: number; y: number }) => void
  onTaskClick:   (task: SerializedTask) => void
  onTaskPatch:   (id: string, patch: { scheduledAt?: string | null; startTime?: string | null; endTime?: string | null }) => void
}

export function TimeGrid({ days, tasks, today, onQuickCreate, onTaskClick, onTaskPatch }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  // Mirrors `drag` synchronously so the pointerup handler can read the final
  // value and invoke the parent's callbacks (onTaskPatch/onTaskClick) from
  // plain function-body code — never from inside a setState updater, since
  // React may re-invoke updaters outside the normal commit flow and calling
  // another component's setState from in there trips "Cannot update a
  // component while rendering a different component".
  const dragRef = useRef<DragState | null>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const propsRef = useRef({ tasks, days, onTaskPatch, onTaskClick })
  useEffect(() => { propsRef.current = { tasks, days, onTaskPatch, onTaskClick } })
  // A completed move/resize drag can leave a stray native "click" on the
  // element under the cursor at release (e.g. the day column background),
  // which would otherwise pop open the quick-create popover unexpectedly.
  const suppressNextClick = useRef(false)

  function applyDrag(next: DragState | null) {
    dragRef.current = next
    setDrag(next)
  }

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const prev = dragRef.current
      if (!prev) return
      const dx = e.clientX - prev.startClientX
      const dy = e.clientY - prev.startClientY
      const moved = prev.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4

      if (prev.mode === 'resize') {
        const deltaMin = snap(dy / PX_PER_MIN)
        const newEnd = clamp(prev.origEndMin + deltaMin, prev.origStartMin + MIN_BLOCK_MIN, TOTAL_MIN + GRID_START_HOUR * 60)
        applyDrag({ ...prev, moved, endMin: newEnd })
        return
      }

      const deltaMin = snap(dy / PX_PER_MIN)
      const duration = prev.origEndMin - prev.origStartMin
      const newStart = clamp(prev.origStartMin + deltaMin, GRID_START_HOUR * 60, GRID_START_HOUR * 60 + TOTAL_MIN - duration)

      let newDayIdx = prev.dayIdx
      const rects = columnRefs.current.map((el) => el?.getBoundingClientRect())
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        if (r && e.clientX >= r.left && e.clientX < r.right) { newDayIdx = i; break }
      }

      applyDrag({ ...prev, moved, startMin: newStart, endMin: newStart + duration, dayIdx: newDayIdx })
    }

    function handleUp() {
      document.body.classList.remove('select-none')
      const prev = dragRef.current
      if (!prev) return
      applyDrag(null)

      const { tasks: curTasks, days: curDays, onTaskPatch: patch, onTaskClick: click } = propsRef.current
      if (prev.moved) {
        suppressNextClick.current = true
        const dateStr = localDateStr(curDays[prev.dayIdx])
        if (prev.mode === 'resize') {
          patch(prev.taskId, { endTime: `${dateStr}T${minToHHMM(prev.endMin)}:00.000Z` })
        } else {
          patch(prev.taskId, {
            scheduledAt: `${dateStr}T12:00:00.000Z`,
            startTime:   `${dateStr}T${minToHHMM(prev.startMin)}:00.000Z`,
            endTime:     `${dateStr}T${minToHHMM(prev.endMin)}:00.000Z`,
          })
        }
      } else if (prev.mode === 'move') {
        const task = curTasks.find((t) => t.id === prev.taskId)
        if (task) click(task)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [])

  function startMove(e: React.PointerEvent, task: SerializedTask, dayIdx: number) {
    e.preventDefault()
    document.body.classList.add('select-none')
    const s = startMinutesOf(task), en = endMinutesOf(task)
    applyDrag({
      taskId: task.id, mode: 'move', startClientX: e.clientX, startClientY: e.clientY,
      origDayIdx: dayIdx, origStartMin: s, origEndMin: en, moved: false,
      dayIdx, startMin: s, endMin: en,
    })
  }

  function startResize(e: React.PointerEvent, task: SerializedTask, dayIdx: number) {
    e.preventDefault()
    e.stopPropagation()
    document.body.classList.add('select-none')
    const s = startMinutesOf(task), en = endMinutesOf(task)
    applyDrag({
      taskId: task.id, mode: 'resize', startClientX: e.clientX, startClientY: e.clientY,
      origDayIdx: dayIdx, origStartMin: s, origEndMin: en, moved: false,
      dayIdx, startMin: s, endMin: en,
    })
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutesFromTop = clamp(snap(((e.clientY - rect.top) / PX_PER_HOUR) * 60), 0, TOTAL_MIN - MIN_BLOCK_MIN)
    onQuickCreate(dateStr, GRID_START_HOUR * 60 + minutesFromTop, { x: e.clientX, y: e.clientY })
  }

  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
  const totalHeight = TOTAL_MIN * PX_PER_MIN

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      onClickCapture={(e) => {
        if (suppressNextClick.current) {
          suppressNextClick.current = false
          e.stopPropagation()
          e.preventDefault()
        }
      }}
    >
      {/* Day headers */}
      <div className="flex border-b border-gray-200 shrink-0">
        <div className="w-12 shrink-0" />
        <div className="flex-1 grid" style={gridCols}>
          {days.map((day) => {
            const dateStr = localDateStr(day)
            const isToday = dateStr === today
            const dayIdx  = (day.getDay() + 6) % 7
            return (
              <div key={dateStr} className={`flex flex-col items-center py-2 ${isToday ? 'bg-gold/10' : ''}`}>
                <span className={`text-label font-semibold ${isToday ? 'text-gold' : 'text-gray-500'}`}>{DAY_SHORT[dayIdx]}</span>
                <span className={`text-subheading font-bold ${isToday ? 'text-gold' : 'text-gray-900'}`}>{day.getDate()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Untimed bucket */}
      <UntimedRow days={days} tasks={tasks} onTaskClick={onTaskClick} onQuickCreate={onQuickCreate} gridCols={gridCols} />

      {/* Timed grid, scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: totalHeight }}>
          <div className="w-12 shrink-0 relative">
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute right-2 text-label text-gray-500 tabular-nums"
                style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR - 7 }}
              >
                {h}:00
              </span>
            ))}
          </div>

          <div className="flex-1 grid relative" style={gridCols}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-gray-200/60 pointer-events-none"
                style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR }}
              />
            ))}

            {days.map((day, dayIdx) => {
              const dateStr = localDateStr(day)
              const dayTasks = tasks.filter((t) => t.startTime && t.startTime.slice(0, 10) === dateStr)
              return (
                <div
                  key={dateStr}
                  ref={(el) => { columnRefs.current[dayIdx] = el }}
                  className="relative border-r border-gray-100 last:border-r-0 cursor-pointer"
                  style={{ height: totalHeight }}
                  onClick={(e) => handleColumnClick(e, dateStr)}
                >
                  {dayTasks.map((task) => {
                    const live = drag && drag.taskId === task.id ? drag : null
                    const startMin = live ? live.startMin : startMinutesOf(task)
                    const endMin   = live ? live.endMin   : endMinutesOf(task)
                    const top    = (startMin - GRID_START_HOUR * 60) * PX_PER_MIN
                    const height = Math.max(MIN_BLOCK_MIN * PX_PER_MIN, (endMin - startMin) * PX_PER_MIN)
                    const isDraggingThis = live && live.moved
                    // While dragged into a different column, render it there instead
                    if (live && live.dayIdx !== dayIdx) return null

                    return (
                      <div
                        key={task.id}
                        onPointerDown={(e) => startMove(e, task, dayIdx)}
                        style={{ position: 'absolute', top, height, left: 3, right: 3, zIndex: isDraggingThis ? 20 : 1 }}
                        className={`rounded-control border px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-shadow ${STATUS_BG[task.status] ?? 'bg-gray-50 border-gray-300'} ${isDraggingThis ? 'shadow-e3 opacity-90' : 'shadow-e1'}`}
                      >
                        <p className="text-label font-semibold text-gray-900 truncate leading-tight">{task.title}</p>
                        <p className="text-label text-gray-500 tabular-nums truncate">
                          {minToHHMM(startMin)}–{minToHHMM(endMin)}
                        </p>
                        {task.client && (
                          <p className="text-label text-gray-500 truncate">
                            {task.client.firstName} {task.client.lastName}
                          </p>
                        )}
                        <div
                          onPointerDown={(e) => startResize(e, task, dayIdx)}
                          className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize"
                        />
                      </div>
                    )
                  })}

                  {/* Ghost preview when a task is being dragged INTO this column from elsewhere */}
                  {drag && drag.moved && drag.dayIdx === dayIdx && !dayTasks.some((t) => t.id === drag.taskId) && (() => {
                    const task = tasks.find((t) => t.id === drag.taskId)
                    if (!task) return null
                    const top    = (drag.startMin - GRID_START_HOUR * 60) * PX_PER_MIN
                    const height = Math.max(MIN_BLOCK_MIN * PX_PER_MIN, (drag.endMin - drag.startMin) * PX_PER_MIN)
                    return (
                      <div
                        style={{ position: 'absolute', top, height, left: 3, right: 3, zIndex: 20 }}
                        className={`rounded-control border px-2 py-1 overflow-hidden select-none shadow-e3 opacity-90 ${STATUS_BG[task.status] ?? 'bg-gray-50 border-gray-300'}`}
                      >
                        <p className="text-label font-semibold text-gray-900 truncate leading-tight">{task.title}</p>
                        <p className="text-label text-gray-500 tabular-nums truncate">{minToHHMM(drag.startMin)}–{minToHHMM(drag.endMin)}</p>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Untimed bucket row (drag between days via dnd-kit, click opens popover) ─
function UntimedRow({
  days, tasks, onTaskClick, onQuickCreate, gridCols,
}: {
  days: Date[]; tasks: SerializedTask[]; onTaskClick: (t: SerializedTask) => void
  onQuickCreate: (dateStr: string, startMinutes: number | null, anchor: { x: number; y: number }) => void
  gridCols: React.CSSProperties
}) {
  return (
    <div className="flex border-b border-gray-200 bg-gray-50/50 shrink-0">
      <div className="w-12 shrink-0 flex items-start justify-end pt-1.5 pr-1.5">
        <span className="text-label text-gray-500">весь&nbsp;день</span>
      </div>
      <div className="flex-1 grid" style={gridCols}>
        {days.map((day) => {
          const dateStr = localDateStr(day)
          const dayTasks = tasks.filter((t) => !t.startTime && t.scheduledAt?.slice(0, 10) === dateStr)
          return (
            <UntimedCell key={dateStr} dateStr={dateStr} tasks={dayTasks} onTaskClick={onTaskClick} onQuickCreate={onQuickCreate} />
          )
        })}
      </div>
    </div>
  )
}

function UntimedCell({
  dateStr, tasks, onTaskClick, onQuickCreate,
}: {
  dateStr: string; tasks: SerializedTask[]; onTaskClick: (t: SerializedTask) => void
  onQuickCreate: (dateStr: string, startMinutes: number | null, anchor: { x: number; y: number }) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateStr}` })
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { if (e.target === e.currentTarget) onQuickCreate(dateStr, null, { x: e.clientX, y: e.clientY }) }}
      className={`min-h-[36px] p-1 flex flex-col gap-1 border-r border-gray-100 last:border-r-0 cursor-pointer transition-colors ${isOver ? 'bg-info/10' : ''}`}
    >
      {tasks.map((t) => <UntimedPill key={t.id} task={t} onClick={() => onTaskClick(t)} />)}
    </div>
  )
}

function UntimedPill({ task, onClick }: { task: SerializedTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`rounded-control border px-2 py-0.5 cursor-grab active:cursor-grabbing transition select-none flex items-center gap-1.5 min-w-0 ${STATUS_BG[task.status] ?? 'bg-gray-50 border-gray-300'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[task.status] ?? 'bg-gray-400'}`} />
      <span className="text-label text-gray-900 font-medium truncate">{task.title}</span>
      {task.client && <span className="text-label text-gray-500 truncate shrink-0">· {task.client.firstName} {task.client.lastName}</span>}
    </div>
  )
}
