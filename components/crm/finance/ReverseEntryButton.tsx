'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReverseEntryButton({ endpoint, label }: { endpoint: string; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleReverse() {
    if (!confirm(`Сторнировать ${label}? Будет создана обратная запись сегодняшним днём, исходная останется в истории.`)) return
    setBusy(true)
    const res = await fetch(endpoint, { method: 'POST' })
    setBusy(false)
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Не удалось сторнировать')
    }
  }

  return (
    <button
      onClick={handleReverse}
      disabled={busy}
      className="text-gray-500 hover:text-warning text-label px-1.5 py-0.5 rounded transition disabled:opacity-50"
      title="Сторно"
    >
      {busy ? '...' : '↩'}
    </button>
  )
}
