'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { key: 'IN_PROGRESS', label: 'В работе',  color: 'border-[#E67E22]/40 text-[#E67E22]' },
  { key: 'DONE',        label: 'Выполнена', color: 'border-[#27AE60]/40 text-[#27AE60]' },
  { key: 'PROBLEM',     label: 'Проблема',  color: 'border-[#C0392B]/40 text-[#C0392B]' },
] as const

interface Props {
  taskId:  string
  current: string
}

export function QuickStatusPanel({ taskId, current }: Props) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(status: string) {
    if (status === current || busy) return
    setBusy(true)
    await fetch(`/api/crm/tasks/${taskId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
      <p className="text-white/40 text-xs mb-3">Быстрый статус</p>
      {STATUSES.map((s) => {
        const isActive = current === s.key
        return (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            disabled={isActive || busy}
            className={`w-full py-2 rounded-lg border text-xs transition ${
              isActive
                ? `opacity-80 cursor-default ${s.color}`
                : `bg-white/3 hover:bg-white/8 border-white/10 text-white/50`
            }`}
          >
            {isActive ? '✓ ' : ''}{s.label}
          </button>
        )
      })}
    </div>
  )
}