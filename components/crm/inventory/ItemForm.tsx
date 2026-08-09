'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Button } from '@/components/crm/ui'

interface ItemData {
  id:          string
  name:        string
  category:    string
  unit:        string
  qtyMinAlert: number | string
  costPrice:   number | string
  sellPrice:   number | string
  supplier:    string
  notes:       string
}

interface Props { item?: ItemData; categories: string[] }

const UNITS = ['шт', 'л', 'кг', 'м', 'компл', 'пар', 'уп']

export function ItemForm({ item, categories }: Props) {
  const router = useRouter()
  const isEdit = !!item

  const [form, setForm] = useState({
    name:        item?.name        ?? '',
    category:    item?.category    ?? '',
    unit:        item?.unit        ?? 'шт',
    qtyMinAlert: String(item?.qtyMinAlert ?? '0'),
    costPrice:   String(item?.costPrice   ?? '0'),
    sellPrice:   String(item?.sellPrice   ?? '0'),
    supplier:    item?.supplier    ?? '',
    notes:       item?.notes       ?? '',
    newCategory: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set(key: string, val: string) { setForm((p) => ({ ...p, [key]: val })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError(null)

    const category = form.newCategory.trim() || form.category

    const body = {
      name:        form.name.trim(),
      category,
      unit:        form.unit,
      qtyMinAlert: parseFloat(form.qtyMinAlert) || 0,
      costPrice:   parseFloat(form.costPrice)   || 0,
      sellPrice:   parseFloat(form.sellPrice)   || 0,
      supplier:    form.supplier.trim(),
      notes:       form.notes.trim(),
    }

    try {
      const res = await fetch(
        isEdit ? `/api/crm/inventory/${item!.id}` : '/api/crm/inventory',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      )
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Ошибка')
      router.push('/crm/inventory')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сервера')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!item || !confirm('Удалить товар? Движения по нему сохранятся.')) return
    setSaving(true)
    await fetch(`/api/crm/inventory/${item.id}`, { method: 'DELETE' })
    router.push('/crm/inventory')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-control px-4 py-3 text-danger text-body">{error}</div>
      )}

      <Input label="Название *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Alternator 80Ah 12V" autoFocus />

      <div className="grid grid-cols-2 gap-4">
        {/* Category — select existing or type new */}
        <div className="space-y-1">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Категория</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          >
            <option value="">— выбрать —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ новая категория</option>
          </select>
          {(form.category === '__new__' || !form.category) && (
            <Input
              placeholder="Electrical, Fuel, Paints…"
              value={form.newCategory}
              onChange={(e) => set('newCategory', e.target.value)}
            />
          )}
        </div>

        {/* Unit */}
        <div className="space-y-1">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Единица</label>
          <select
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 shadow-e1 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input label="Мин. остаток" type="number" step="0.001" min="0" value={form.qtyMinAlert} onChange={(e) => set('qtyMinAlert', e.target.value)} suffix={form.unit} />
        <Input label="Закупочная €" type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
        <Input label="Продажная €"  type="number" step="0.01" min="0" value={form.sellPrice} onChange={(e) => set('sellPrice', e.target.value)} />
      </div>

      <Input label="Поставщик" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="Repuestos Náuticos SL" />
      <Input label="Заметки"   value={form.notes}    onChange={(e) => set('notes',    e.target.value)} placeholder="Дополнительная информация" />

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={saving}>{isEdit ? 'Сохранить' : 'Добавить товар'}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Отмена</Button>
        {isEdit && (
          <Button type="button" variant="danger" onClick={handleDelete} disabled={saving} className="ml-auto">
            Удалить
          </Button>
        )}
      </div>
    </form>
  )
}