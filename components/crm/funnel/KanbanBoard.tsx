'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard, type FunnelClient } from './KanbanCard'
import { FUNNEL_STAGE_LABELS } from '@/lib/crm/utils'

const STAGES = Object.keys(FUNNEL_STAGE_LABELS) as Array<keyof typeof FUNNEL_STAGE_LABELS>

interface Props { initialClients: FunnelClient[] }

async function patchStage(clientId: string, toStage: string) {
  const res = await fetch('/api/crm/funnel', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ clientId, toStage }),
  })
  if (!res.ok) throw new Error('server error')
}

export function KanbanBoard({ initialClients }: Props) {
  const [clients,  setClients]  = useState<FunnelClient[]>(initialClients)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter,   setFilter]   = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Optimistic stage update
  function applyStage(clientId: string, toStage: string) {
    const client = clients.find((c) => c.id === clientId)
    if (!client || client.funnelStage === toStage) return

    setClients((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, funnelStage: toStage } : c),
    )

    patchStage(clientId, toStage).catch(() => {
      // rollback
      setClients((prev) =>
        prev.map((c) => c.id === clientId ? { ...c, funnelStage: client.funnelStage } : c),
      )
    })
  }

  const handleMovePrev = useCallback((clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (!client) return
    const idx = STAGES.indexOf(client.funnelStage as (typeof STAGES)[number])
    if (idx > 0) applyStage(clientId, STAGES[idx - 1])
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMoveNext = useCallback((clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (!client) return
    const idx = STAGES.indexOf(client.funnelStage as (typeof STAGES)[number])
    if (idx < STAGES.length - 1) applyStage(clientId, STAGES[idx + 1])
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  function onDragStart({ active }: DragStartEvent) { setActiveId(active.id as string) }

  const onDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    applyStage(active.id as string, over.id as string)
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter
  const q = filter.toLowerCase()
  const filtered = q
    ? clients.filter((c) => {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase()
        const job  = (c.latestTask?.title ?? '').toLowerCase()
        return name.includes(q) || job.includes(q) || c.marina.toLowerCase().includes(q)
      })
    : clients

  const clientsByStage = STAGES.reduce<Record<string, FunnelClient[]>>((acc, stage) => {
    acc[stage] = filtered.filter((c) => c.funnelStage === stage)
    return acc
  }, {})

  const activeClient = activeId ? clients.find((c) => c.id === activeId) : null

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Filter row */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-label text-gray-500">
          {filtered.length} из {clients.length} клиентов
        </p>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Фильтр по клиенту или работе…"
          className="w-56 bg-white border border-gray-200 rounded-control px-3 py-1.5 text-label text-gray-900 placeholder:text-gray-500 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info transition"
        />
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-2 flex-1 min-h-0">
          {STAGES.map((stage, i) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              label={FUNNEL_STAGE_LABELS[stage]}
              clients={clientsByStage[stage] ?? []}
              onMovePrev={handleMovePrev}
              onMoveNext={handleMoveNext}
              isFirst={i === 0}
              isLast={i === STAGES.length - 1}
            />
          ))}
        </div>

        <DragOverlay>
          {activeClient && <KanbanCard client={activeClient} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}