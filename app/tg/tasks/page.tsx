'use client'

import { useEffect, useState } from 'react'
import { useTg } from '@/components/tg/TgProvider'
import { TgShell } from '@/components/tg/TgShell'
import { TgCard, TgButton, TgInput, TgSpinner, TgEmpty } from '@/components/tg/ui'
import { Badge, TASK_TONE } from '@/components/crm/ui/Badge'
import { TASK_STATUS_LABELS } from '@/lib/crm/utils'
import type { TaskStatus } from '@prisma/client'

interface Task {
  id: string
  title: string
  marina: string
  status: TaskStatus
  scheduledAt: string | null
  startTime: string | null
  isBacklog: boolean
  client: { id: string; firstName: string; lastName: string; marina: string } | null
}

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  NEW: 'SCHEDULED',
  SCHEDULED: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
}

export default function TgTasksPage() {
  const { ready, tgFetch, haptic } = useTg()
  const [today, setToday] = useState<Task[] | null>(null)
  const [backlog, setBacklog] = useState<Task[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  const load = () => {
    tgFetch('/api/tg/tasks').then((r) => r.json()).then((d) => { setToday(d.today); setBacklog(d.backlog) })
      .catch(() => { setToday([]); setBacklog([]) })
  }

  useEffect(() => { if (ready) load() }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = async (task: Task) => {
    const next = NEXT_STATUS[task.status]
    if (!next) return
    setBusyId(task.id)
    const res = await tgFetch(`/api/tg/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setBusyId(null)
    if (res.ok) { haptic('medium'); load() }
  }

  const addTask = async () => {
    if (!title.trim()) return
    setAddBusy(true)
    const res = await tgFetch('/api/tg/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setAddBusy(false)
    if (res.ok) {
      haptic('light')
      setTitle('')
      setShowAdd(false)
      load()
    }
  }

  const renderTask = (task: Task) => (
    <TgCard key={task.id} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-navy-900 text-sm">{task.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {task.client ? `${task.client.firstName} ${task.client.lastName} · ` : ''}
            {task.marina || '—'}
            {task.startTime && ` · ${new Date(task.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>
        <Badge tone={TASK_TONE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
      </div>
      {task.status !== 'DONE' && task.status !== 'PROBLEM' && task.status !== 'CANCELLED_BY_CLIENT' && (
        <TgButton variant="secondary" disabled={busyId === task.id} onClick={() => advance(task)}>
          {busyId === task.id ? '...' : `→ ${TASK_STATUS_LABELS[NEXT_STATUS[task.status]!]}`}
        </TgButton>
      )}
    </TgCard>
  )

  return (
    <TgShell title="Задачи">
      {today === null || backlog === null ? (
        <TgSpinner />
      ) : (
        <>
          <TgButton variant="secondary" className="w-full mb-3" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Отменить' : '+ Быстрая задача'}
          </TgButton>

          {showAdd && (
            <TgCard className="flex flex-col gap-2 mb-3">
              <TgInput value={title} onChange={setTitle} placeholder="Название задачи" />
              <TgButton variant="secondary" disabled={addBusy} onClick={addTask}>
                {addBusy ? 'Добавляю…' : 'Добавить в бэклог'}
              </TgButton>
            </TgCard>
          )}

          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 px-1">Сегодня</div>
          {today.length === 0 ? <TgEmpty text="На сегодня задач нет" /> : (
            <div className="flex flex-col gap-2 mb-4">{today.map(renderTask)}</div>
          )}

          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 px-1">Бэклог</div>
          {backlog.length === 0 ? <TgEmpty text="Бэклог пуст" /> : (
            <div className="flex flex-col gap-2">{backlog.map(renderTask)}</div>
          )}
        </>
      )}
    </TgShell>
  )
}
