'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/crm/ui'

interface InventoryItemOption {
  id: string
  name: string
  unit: string
  sellPrice: string
}

interface MaterialRow {
  name: string
  quantity: string
  unitPrice: string
  inventoryItemId: string | null
}

function emptyMaterial(): MaterialRow {
  return { name: '', quantity: '1', unitPrice: '0', inventoryItemId: null }
}

export function AddWorkForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [laborHours, setLaborHours] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [withDate, setWithDate] = useState(false)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [items, setItems] = useState<InventoryItemOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/crm/inventory').then((r) => r.json()).then((data: InventoryItemOption[]) => setItems(data)).catch(() => setItems([]))
  }, [open])

  const addMaterial = () => setMaterials((m) => [...m, emptyMaterial()])
  const updateMaterial = (i: number, patch: Partial<MaterialRow>) =>
    setMaterials((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const removeMaterial = (i: number) => setMaterials((m) => m.filter((_, idx) => idx !== i))

  const reset = () => {
    setTitle(''); setLaborHours(''); setLaborRate(''); setLaborCost('')
    setMaterials([]); setWithDate(false); setDate(''); setStartTime(''); setEndTime('')
  }

  const submit = async () => {
    setError(null)
    if (!title.trim()) { setError('Укажите название работы'); return }
    if (withDate && !date) { setError('Укажите дату'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/works`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          laborHours: laborHours || undefined,
          laborRate: laborRate || undefined,
          laborCost: laborCost || '0',
          materials: materials
            .filter((m) => m.name.trim())
            .map((m) => ({ name: m.name, quantity: m.quantity, unitPrice: m.unitPrice, inventoryItemId: m.inventoryItemId })),
          ...(withDate && {
            scheduledAt: `${date}T12:00:00.000Z`,
            startTime: startTime ? `${date}T${startTime}:00.000Z` : null,
            endTime: endTime ? `${date}T${endTime}:00.000Z` : null,
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      reset()
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Добавить работу</Button>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-label text-gray-500 font-semibold uppercase tracking-wide">Новая работа</h3>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-900 text-label transition">Отмена</button>
      </div>

      <Input label="Название работы" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, замена импеллера" />

      <div className="grid grid-cols-3 gap-3">
        <Input label="Часы" type="number" min={0} value={laborHours} onChange={(e) => setLaborHours(e.target.value)} placeholder="0" />
        <Input label="Ставка €/час" type="number" min={0} value={laborRate} onChange={(e) => setLaborRate(e.target.value)} placeholder="0" />
        <Input label="Или фикс. сумма €" type="number" min={0} value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-label text-gray-500 uppercase tracking-wide">Материалы</p>
          <button onClick={addMaterial} className="text-gold hover:text-gold-dark text-label transition">+ Материал</button>
        </div>
        {materials.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
            <select
              value={m.inventoryItemId ?? ''}
              onChange={(e) => {
                const item = items.find((it) => it.id === e.target.value)
                if (item) updateMaterial(i, { name: item.name, unitPrice: item.sellPrice, inventoryItemId: item.id })
                else updateMaterial(i, { inventoryItemId: null })
              }}
              className="rounded-control border border-gray-200 px-2 py-1.5 text-label text-gray-900"
            >
              <option value="">{m.name || '— вручную/со склада —'}</option>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
            <input
              type="number" min={0} value={m.quantity} onChange={(e) => updateMaterial(i, { quantity: e.target.value })}
              className="w-16 rounded-control border border-gray-200 px-2 py-1.5 text-label text-gray-900" placeholder="Кол-во"
            />
            <input
              type="number" min={0} value={m.unitPrice} onChange={(e) => updateMaterial(i, { unitPrice: e.target.value, inventoryItemId: null })}
              className="w-20 rounded-control border border-gray-200 px-2 py-1.5 text-label text-gray-900" placeholder="Цена"
            />
            <button onClick={() => removeMaterial(i)} className="text-gray-500 hover:text-danger transition">✕</button>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-body text-gray-900 cursor-pointer select-none">
        <input type="checkbox" checked={withDate} onChange={(e) => setWithDate(e.target.checked)} />
        Задать дату — работа появится в календаре
      </label>
      {withDate && (
        <div className="grid grid-cols-3 gap-3">
          <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Начало" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="Конец" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}

      {error && <p className="text-body text-danger">{error}</p>}
      <Button disabled={saving} onClick={submit}>{saving ? 'Сохраняю…' : 'Добавить работу'}</Button>
    </div>
  )
}
