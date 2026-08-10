'use client'

import { useEffect, useRef, useState, forwardRef } from 'react'
import type { CategoryKind } from '@prisma/client'

export interface CategoryOption {
  id:   string
  name: string
}

interface Props {
  kind:       CategoryKind
  value:      CategoryOption | null
  onChange:   (cat: CategoryOption | null) => void
  onConfirm?: () => void
  placeholder?: string
}

// Комбобокс категорий: печатаешь — фильтрует уже известные; если точного
// совпадения нет — «+ Добавить «X»» создаёт категорию на лету через API и сразу
// выбирает её. Список растёт сам, отдельный для каждого kind (доход/расход/зарплата).
export const CategoryCombobox = forwardRef<HTMLInputElement, Props>(function CategoryCombobox(
  { kind, value, onChange, onConfirm, placeholder },
  ref,
) {
  const [options,  setOptions]  = useState<CategoryOption[]>([])
  const [query,    setQuery]    = useState(value?.name ?? '')
  const [open,     setOpen]     = useState(false)
  const [creating, setCreating] = useState(false)
  const skipNextValueSync = useRef(false)

  useEffect(() => {
    if (skipNextValueSync.current) { skipNextValueSync.current = false; return }
    setQuery(value?.name ?? '')
  }, [value])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/crm/categories?kind=${kind}`)
      .then((r) => r.json())
      .then((data: CategoryOption[]) => { if (!cancelled) setOptions(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [kind])

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
  const exactMatch = options.find((o) => o.name.toLowerCase() === q)

  function pick(opt: CategoryOption) {
    skipNextValueSync.current = true
    onChange(opt)
    setQuery(opt.name)
    setOpen(false)
    onConfirm?.()
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    const res = await fetch('/api/crm/categories', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ kind, name }),
    })
    setCreating(false)
    if (!res.ok) return
    const cat: CategoryOption = await res.json()
    setOptions((prev) => (prev.some((p) => p.id === cat.id) ? prev : [...prev, cat].sort((a, b) => a.name.localeCompare(b.name))))
    pick(cat)
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
        placeholder={placeholder ?? 'Категория…'}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (exactMatch) pick(exactMatch)
          else if (query.trim()) void handleCreate()
        }}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-control shadow-e2">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={() => pick(o)}
              className="w-full text-left px-3 py-2 text-body text-gray-900 hover:bg-gray-50 transition"
            >
              {o.name}
            </button>
          ))}
          {q && !exactMatch && (
            <button
              type="button"
              onMouseDown={handleCreate}
              disabled={creating}
              className="w-full text-left px-3 py-2 text-body text-info hover:bg-info/5 transition font-medium border-t border-gray-100"
            >
              + Добавить «{query.trim()}»
            </button>
          )}
          {filtered.length === 0 && !q && (
            <p className="px-3 py-2 text-label text-gray-500">Начните вводить название</p>
          )}
        </div>
      )}
    </div>
  )
})
