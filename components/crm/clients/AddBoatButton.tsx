'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/crm/ui'

export function AddBoatButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [name,   setName]   = useState('')
  const [model,  setModel]  = useState('')
  const [marina, setMarina] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/crm/boats', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientId, name, model, marina }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    setOpen(false); setName(''); setModel(''); setMarina('')
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-info text-label font-medium hover:underline">
        + Лодка
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-card shadow-e4 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-subheading font-bold text-gray-900">Новая лодка</h2>
              <button onClick={() => setOpen(false)} className="text-gray-200 hover:text-gray-500 text-body transition">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sea Breeze" autoFocus />
              <Input label="Модель" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Beneteau Oceanis 40" />
              <Input label="Марина" value={marina} onChange={(e) => setMarina(e.target.value)} placeholder="Puerto Blanco" />
              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
              )}
              <Button type="submit" loading={saving} className="w-full justify-center">Добавить лодку</Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
