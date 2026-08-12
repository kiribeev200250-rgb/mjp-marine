'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('Удалить эту запись?')) return
    setBusy(true)
    const res = await fetch(`/api/crm/finance/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Не удалось удалить')
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="text-gray-500 hover:text-danger text-label px-1.5 py-0.5 rounded transition"
      title="Удалить"
    >
      ✕
    </button>
  )
}