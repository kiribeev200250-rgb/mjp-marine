'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/crm/ui'

export function CreateProjectButton({ boatId }: { boatId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!name.trim()) { setError('Укажите название'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/crm/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId, name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      router.push(`/crm/projects/${data.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>📁 Создать проект</Button>
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Сезон 2026" className="w-48" />
      <Button size="sm" disabled={saving} onClick={submit}>{saving ? 'Создаю…' : 'Создать'}</Button>
      <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-900 text-label transition">Отмена</button>
      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  )
}
