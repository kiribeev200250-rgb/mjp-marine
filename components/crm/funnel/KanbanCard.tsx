'use client'

import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface FunnelClient {
  id: string; firstName: string; lastName: string
  marina: string; source: string; funnelStage: string
  updatedAt: string; language: string; phone: string
  _count: { invoices: number; tasks: number }
  invoices: { total: { toString(): string } }[]
  latestTask: { title: string } | null
}

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
  client:       FunnelClient
  isDragging?:  boolean
  onMovePrev?:  (id: string) => void
  onMoveNext?:  (id: string) => void
  canMovePrev?: boolean
  canMoveNext?: boolean
}

export function KanbanCard({
  client, isDragging, onMovePrev, onMoveNext, canMovePrev, canMoveNext,
}: Props) {
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: client.id })

  const openAmount = client.invoices.reduce(
    (s, inv) => s + parseFloat(inv.total.toString()), 0,
  )

  const jobTitle = client.latestTask?.title
    ?? `${client.firstName} ${client.lastName}`

  const dot = STAGE_DOT[client.funnelStage] ?? 'bg-gray-200'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isSortableDragging ? 0.4 : 1 }}
      className={`bg-white border rounded-card select-none shadow-e1 transition group ${
        isDragging
          ? 'shadow-e4 rotate-1 border-gray-300'
          : 'border-gray-200 hover:shadow-e2 hover:border-gray-300'
      }`}
    >
      {/* Drag handle area */}
      <div
        className="px-3 pt-3 pb-2 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {/* Stage dot + job title */}
        <div className="flex items-start gap-2 mb-1">
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <Link
            href={`/crm/clients/${client.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-gray-900 text-label font-semibold leading-snug hover:text-gold transition flex-1 min-w-0 line-clamp-2"
          >
            {jobTitle}
          </Link>
        </div>

        {/* Client name */}
        {client.latestTask && (
          <p className="text-gray-500 text-[10px] pl-4">
            {client.firstName} {client.lastName}
          </p>
        )}

        {/* Marina */}
        {client.marina && (
          <p className="text-gray-200 text-[10px] pl-4 mt-0.5">⚓ {client.marina}</p>
        )}
      </div>

      {/* Footer: amount + nav arrows */}
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5 border-t border-gray-100">
        {openAmount > 0 ? (
          <span className="text-warning text-[10px] font-bold tabular-nums">
            {openAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        ) : (
          <span className="text-gray-200 text-[10px]">—</span>
        )}

        {/* Stage nav arrows */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); onMovePrev?.(client.id) }}
            disabled={!canMovePrev}
            className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-20 text-gray-500 text-[10px] transition"
            title="Назад по воронке"
          >
            ◁
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveNext?.(client.id) }}
            disabled={!canMoveNext}
            className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-20 text-gray-500 text-[10px] transition"
            title="Вперёд по воронке"
          >
            ▷
          </button>
        </div>
      </div>
    </div>
  )
}