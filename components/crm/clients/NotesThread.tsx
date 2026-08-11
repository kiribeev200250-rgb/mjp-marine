'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/crm/ui'

interface NoteItem {
  id:         string
  text:       string
  createdAt:  string
  authorName: string | null
}

interface Props {
  clientId?: string
  boatId?:   string
  initial:   NoteItem[]
}

// Растущая лента датированных заметок — отдельно от единичного свободного поля
// Client.notes/Yacht.notes. Привязка либо к клиенту, либо к лодке (ровно одна).
export function NotesThread({ clientId, boatId, initial }: Props) {
  const router = useRouter()
  const [notes,  setNotes]  = useState(initial)
  const [text,   setText]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true); setError(null)
    const res = await fetch('/api/crm/notes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientId, boatId, text }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    const note = await res.json()
    setNotes((prev) => [{ id: note.id, text: note.text, createdAt: note.createdAt, authorName: note.author?.name ?? null }, ...prev])
    setText('')
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить заметку?')) return
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/crm/notes/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5">
      <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-4">Примечания</h2>
      <div className="space-y-2 mb-3">
        <textarea
          className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          rows={2}
          placeholder="Новая заметка…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="text-danger text-label">{error}</p>}
        <Button size="sm" loading={saving} onClick={handleAdd}>Добавить</Button>
      </div>
      {notes.length === 0 ? (
        <p className="text-body text-gray-300 text-center py-3">Заметок пока нет</p>
      ) : (
        <div className="space-y-3 divide-y divide-gray-100">
          {notes.map((n) => (
            <div key={n.id} className="pt-3 first:pt-0 group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body text-gray-900 whitespace-pre-wrap flex-1">{n.text}</p>
                <button onClick={() => handleDelete(n.id)} className="text-gray-200 hover:text-danger transition opacity-0 group-hover:opacity-100 shrink-0">✕</button>
              </div>
              <p className="text-label text-gray-500 mt-1">
                {new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(n.createdAt))}
                {n.authorName ? ` · ${n.authorName}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
