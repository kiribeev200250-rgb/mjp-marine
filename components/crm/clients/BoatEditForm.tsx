'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/crm/ui'

interface ClientOption { id: string; firstName: string; lastName: string }

interface BoatData {
  id:        string
  clientId:  string
  name:      string
  model:     string
  length:    string
  engine:    string
  marina:    string
  regNumber: string
  notes:     string
}

interface Props {
  boat:    BoatData
  clients: ClientOption[]
}

export function BoatEditForm({ boat, clients }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    clientId:  boat.clientId,
    name:      boat.name,
    model:     boat.model,
    length:    boat.length,
    engine:    boat.engine,
    marina:    boat.marina,
    regNumber: boat.regNumber,
    notes:     boat.notes,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const reassigned = form.clientId !== boat.clientId

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (reassigned && !confirm('Переназначить лодку другому клиенту? История (сметы, счета, задачи) останется при лодке.')) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/crm/boats/${boat.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    setEditing(false)
    if (reassigned) {
      router.push(`/crm/clients/${form.clientId}/boats/${boat.id}`)
      return
    }
    router.refresh()
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-label text-gray-500 hover:text-gold transition">
        ✏ Редактировать
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setEditing(false)}>
      <div className="bg-white rounded-card shadow-e4 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-subheading font-bold text-gray-900">Редактировать лодку</h2>
          <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-900 text-body transition">✕</button>
        </div>
        <div className="space-y-3">
          <Input label="Название" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Модель" value={form.model} onChange={(e) => set('model', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Длина, м" type="number" step="0.1" value={form.length} onChange={(e) => set('length', e.target.value)} />
            <Input label="Двигатель/привод" value={form.engine} onChange={(e) => set('engine', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Марина" value={form.marina} onChange={(e) => set('marina', e.target.value)} />
            <Input label="Рег. номер" value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="block text-label text-gray-500 uppercase tracking-wide">Заметка</label>
            <textarea
              className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-label text-gray-500 uppercase tracking-wide">Владелец</label>
            <select
              value={form.clientId}
              onChange={(e) => set('clientId', e.target.value)}
              className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
            {reassigned && (
              <p className="text-label text-warning">Лодка будет переназначена — история (сметы/счета/задачи) останется при ней.</p>
            )}
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
          )}

          <Button onClick={handleSave} loading={saving} className="w-full justify-center">Сохранить</Button>
        </div>
      </div>
    </div>
  )
}
