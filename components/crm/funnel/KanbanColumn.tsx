'use client'

import Link from 'next/link'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard, type FunnelClient } from './KanbanCard'

const STAGE_DOT: Record<string, string> = {
  NEW_LEAD:       'bg-gray-200',
  CONTACT_MADE:   'bg-info',
  QUOTE_SENT:     'bg-purple-400',
  WORK_SCHEDULED: 'bg-warning',
  WORK_DONE:      'bg-teal-400',
  INVOICE_SENT:   'bg-orange-400',
  PAID:           'bg-success',
}

interface Props {
  stage:       string
  label:       string
  clients:     FunnelClient[]
  onMovePrev:  (id: string) => void
  onMoveNext:  (id: string) => void
  isFirst:     boolean
  isLast:      boolean
}

export function KanbanColumn({ stage, label, clients, onMovePrev, onMoveNext, isFirst, isLast }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const dot = STAGE_DOT[stage] ?? 'bg-gray-200'

  return (
    <div className={`flex flex-col shrink-0 w-64 rounded-card border transition-colors ${
      isOver ? 'border-info/40 bg-info/5' : 'border-gray-200 bg-gray-50/60'
    }`}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200/80 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-label font-semibold text-gray-900 flex-1 truncate">{label}</span>
        <span className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-chip px-1.5 py-0.5 tabular-nums">
          {clients.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext id={stage} items={clients.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[100px] overflow-y-auto">
          {clients.map((client) => (
            <KanbanCard
              key={client.id}
              client={client}
              onMovePrev={onMovePrev}
              onMoveNext={onMoveNext}
              canMovePrev={!isFirst}
              canMoveNext={!isLast}
            />
          ))}
          {clients.length === 0 && (
            <div className={`min-h-[80px] border border-dashed rounded-control flex items-center justify-center transition-colors ${
              isOver ? 'border-info/40 bg-info/5' : 'border-gray-200'
            }`}>
              <span className="text-gray-200 text-label">Перетащи сюда</span>
            </div>
          )}
        </div>
      </SortableContext>

      {/* Add button */}
      <div className="px-2 py-1.5 border-t border-gray-200/60">
        <Link
          href={`/crm/clients/new`}
          className="w-full flex items-center justify-center gap-1 text-gray-200 hover:text-gray-500 text-[10px] py-1 rounded transition"
        >
          + добавить
        </Link>
      </div>
    </div>
  )
}