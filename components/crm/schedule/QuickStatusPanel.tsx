'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TASK_STATUS_LABELS } from '@/lib/crm/utils'

const STATUSES = ['NEW', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'PROBLEM'] as const

const STATUS_STYLE: Record<string, { active: string; idle: string }> = {
  NEW:         { active: 'bg-gray-200 text-gray-900 border-gray-300',   idle: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900' },
  SCHEDULED:   { active: 'bg-info/15 text-info border-info/30',         idle: 'border-gray-200 text-gray-500 hover:border-info/40 hover:text-info' },
  IN_PROGRESS: { active: 'bg-warning/15 text-warning border-warning/30', idle: 'border-gray-200 text-gray-500 hover:border-warning/40 hover:text-warning' },
  DONE:        { active: 'bg-success/15 text-success border-success/30', idle: 'border-gray-200 text-gray-500 hover:border-success/40 hover:text-success' },
  PROBLEM:     { active: 'bg-danger/15 text-danger border-danger/30',   idle: 'border-gray-200 text-gray-500 hover:border-danger/40 hover:text-danger' },
}

interface Props {
  taskId:    string
  current:   string
  onChange?: (updated: Record<string, unknown>) => void
}

export function QuickStatusPanel({ taskId, current, onChange }: Props) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(status: string) {
    if (status === current || busy) return
    setBusy(true)
    const res = await fetch(`/api/crm/tasks/${taskId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    setBusy(false)
    if (!res.ok) return
    const updated = await res.json()
    if (onChange) { onChange(updated); return }
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-4 space-y-2">
      <p className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-1">Статус</p>
      <div className="grid grid-cols-1 gap-1.5">
        {STATUSES.map((s) => {
          const isActive = current === s
          const style = STATUS_STYLE[s]
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              disabled={isActive || busy}
              className={`w-full py-2 px-3 rounded-control border text-body font-medium text-left transition ${
                isActive ? `${style.active} cursor-default` : `bg-white ${style.idle}`
              }`}
            >
              {isActive ? '✓ ' : ''}{TASK_STATUS_LABELS[s] ?? s}
            </button>
          )
        })}
      </div>
    </div>
  )
}
