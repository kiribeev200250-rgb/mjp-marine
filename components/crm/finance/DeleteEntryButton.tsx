'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('Удалить эту запись?')) return
    setBusy(true)
    await fetch(`/api/crm/finance/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="text-gray-200 hover:text-danger text-label px-1.5 py-0.5 rounded transition"
      title="Удалить"
    >
      ✕
    </button>
  )
}