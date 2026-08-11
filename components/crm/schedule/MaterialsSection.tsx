'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Input, Button } from '@/components/crm/ui'

export interface InventoryOption { id: string; name: string; unit: string; qtyInStock: string }
export interface TaskMaterial { itemId: string; name: string; unit: string; qty: string }

interface Props {
  taskId:     string
  materials:  TaskMaterial[]
  writtenOff: boolean
  items:      InventoryOption[]
}

export function MaterialsSection({ taskId, materials, writtenOff, items }: Props) {
  const router = useRouter()
  const [list, setList] = useState<TaskMaterial[]>(materials)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InventoryOption | null>(null)
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8)
  }, [items, search])

  async function persist(next: TaskMaterial[]) {
    setSaving(true); setError(null)
    const res = await fetch(`/api/crm/tasks/${taskId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plannedMaterials: next }),
    })
    setSaving(false)
    if (!res.ok) { setError('Не удалось сохранить'); return }
    setList(next)
    router.refresh()
  }

  function handleAdd() {
    if (!selected) return
    const qtyDec = new Decimal(qty || 0)
    if (qtyDec.lte(0)) { setError('Количество должно быть больше нуля'); return }
    const next = [...list, { itemId: selected.id, name: selected.name, unit: selected.unit, qty: qtyDec.toString() }]
    setSelected(null); setSearch(''); setQty('1')
    void persist(next)
  }

  function handleRemove(idx: number) {
    void persist(list.filter((_, i) => i !== idx))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide">Материалы</h2>
        {writtenOff && (
          <span className="text-label text-success font-semibold">✓ Списано</span>
        )}
      </div>

      {list.length === 0 ? (
        <p className="text-body text-gray-500">Материалы не привязаны</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-body">
              <span className="text-gray-900">{m.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-500 tabular-nums">{m.qty} {m.unit}</span>
                {!writtenOff && (
                  <button
                    onClick={() => handleRemove(i)}
                    disabled={saving}
                    className="text-gray-500 hover:text-danger transition"
                    title="Убрать"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!writtenOff && (
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <div className="relative">
            <Input
              placeholder="Поиск по складу…"
              value={selected ? selected.name : search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
            />
            {search && !selected && filtered.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-control shadow-e2">
                {filtered.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-body hover:bg-gray-50 transition"
                    onClick={() => { setSelected(it); setSearch(it.name) }}
                  >
                    <span className="text-gray-900">{it.name}</span>
                    <span className="text-gray-500 text-label"> · в наличии {it.qtyInStock} {it.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-24 rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
            />
            <Button size="sm" type="button" onClick={handleAdd} loading={saving} disabled={!selected}>
              Добавить
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  )
}
