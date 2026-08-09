'use client'

import { useDroppable } from '@dnd-kit/core'
import { TaskCard } from './TaskCard'
import { localDateStr } from '@/lib/crm/utils'
import type { SerializedTask } from './types'

const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

interface Props { date: Date; tasks: SerializedTask[]; today: string; onAdd: (d: string) => void }

export function DayColumn({ date, tasks, today, onAdd }: Props) {
  const dateStr  = localDateStr(date)
  const isToday  = dateStr === today
  const isPast   = dateStr < today
  const dayIndex = (date.getDay() + 6) % 7
  const isWknd   = dayIndex >= 5

  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}` })

  return (
    <div className="flex flex-col min-h-0">
      {/* Заголовок */}
      <div className={`flex items-center justify-between px-2 py-1.5 mb-1 rounded-lg ${isToday ? 'bg-gold/10' : isWknd ? 'bg-gray-100' : ''}`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-label font-semibold ${isToday ? 'text-gold' : isPast ? 'text-gray-200' : isWknd ? 'text-gray-500' : 'text-gray-500'}`}>
            {DAY_SHORT[dayIndex]}
          </span>
          <span className={`text-body font-bold ${isToday ? 'text-gold' : isPast ? 'text-gray-200' : 'text-gray-900'}`}>
            {date.getDate()}
          </span>
          <span className={`text-[10px] ${isToday ? 'text-gold/70' : 'text-gray-200'}`}>
            {date.toLocaleDateString('ru-RU', { month: 'short' })}
          </span>
        </div>
        {tasks.length > 0 && (
          <span className="text-[10px] text-gray-500 bg-gray-100 rounded-chip px-1.5 py-0.5">
            {tasks.length}
          </span>
        )}
      </div>

      {/* Droppable */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-1.5 min-h-[120px] rounded-card p-1.5 border transition-colors ${
          isOver ? 'bg-info/5 border-info/30' : 'border-transparent'
        }`}
      >
        {tasks.map((task) => <TaskCard key={task.id} task={task} compact />)}

        {tasks.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-gray-200 text-[10px]">нет задач</span>
          </div>
        )}

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