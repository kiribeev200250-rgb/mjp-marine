'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/crm/ui'
import type { CategoryKind } from '@prisma/client'

interface CategoryRow {
  id:           string
  kind:         CategoryKind
  name:         string
  archived:     boolean
  entriesCount: number
}

const KIND_LABELS: Record<CategoryKind, string> = {
  INCOME:  'Доходы',
  EXPENSE: 'Расходы',
  SALARY:  'Зарплата',
}

export function CategoryManager({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<CategoryKind>('EXPENSE')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rows = initial.filter((c) => c.kind === tab)

  async function rename(id: string) {
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    setBusy(id); setError(null)
    const res = await fetch(`/api/crm/categories/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })
    setBusy(null); setEditingId(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.refresh()
  }

  async function toggleArchive(id: string, archived: boolean) {
    setBusy(id); setError(null)
    const res = await fetch(`/api/crm/categories/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !archived }),
    })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Удалить категорию? Это можно только если по ней нет операций.')) return
    setBusy(id); setError(null)
    const res = await fetch(`/api/crm/categories/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <div className="flex rounded-control overflow-hidden border border-gray-200 mb-4 w-fit">
        {(Object.keys(KIND_LABELS) as CategoryKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-label font-semibold transition ${
              tab === k ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label mb-4">{error}</div>
      )}

      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 divide-y divide-gray-100">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-body text-gray-500">Категорий пока нет</p>
        ) : rows.map((c) => (
          <div key={c.id} className={`flex items-center gap-3 px-5 py-3 ${c.archived ? 'opacity-50' : ''}`}>
            {editingId === c.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') rename(c.id); if (e.key === 'Escape') setEditingId(null) }}
                onBlur={() => rename(c.id)}
                className="flex-1 rounded-control border border-info bg-white px-2 py-1 text-body text-gray-900 focus:outline-none"
              />
            ) : (
              <span className="flex-1 text-body text-gray-900">{c.name}</span>
            )}
            <span className="text-label text-gray-500 shrink-0">{c.entriesCount} операц{c.entriesCount === 1 ? 'ия' : c.entriesCount >= 2 && c.entriesCount <= 4 ? 'ии' : 'ий'}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="secondary" size="sm"
                loading={busy === c.id && editingId !== c.id}
                onClick={() => { setEditingId(c.id); setEditName(c.name) }}
              >
                ✏
              </Button>
              <Button
                variant="secondary" size="sm"
                loading={busy === c.id}
                onClick={() => toggleArchive(c.id, c.archived)}
              >
                {c.archived ? 'Вернуть' : 'Скрыть'}
              </Button>
              {c.entriesCount === 0 && (
                <Button variant="danger" size="sm" loading={busy === c.id} onClick={() => remove(c.id)}>
                  Удалить
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
