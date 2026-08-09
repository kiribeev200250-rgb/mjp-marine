'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@/components/crm/ui'
import { formatMoney } from '@/lib/crm/utils'

interface Props {
  year:        number
  month:       number
  planRevenue: string
  planMargin:  string
  factRevenue: string
  factMargin:  string
  canEdit:     boolean
}

export function KpiGoalCard({ year, month, planRevenue, planMargin, factRevenue, factMargin, canEdit }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [revenue, setRevenue] = useState(planRevenue)
  const [margin,  setMargin]  = useState(planMargin)
  const [saving,  setSaving]  = useState(false)

  const revenuePct = Number(planRevenue) > 0 ? Math.min(100, (Number(factRevenue) / Number(planRevenue)) * 100) : 0
  const revenuePctExact = Number(planRevenue) > 0 ? (Number(factRevenue) / Number(planRevenue)) * 100 : 0

  async function handleSave() {
    setSaving(true)
    await fetch('/api/crm/kpi-goal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, revenue, margin }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-label text-gray-500 uppercase tracking-wide font-semibold">KPI-цель: план vs факт</h3>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-label text-gold hover:underline">
            {Number(planRevenue) > 0 ? 'Изменить план' : 'Задать план'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-end gap-3">
          <Input label="План по доходу (€)" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
          <Input label="План по марже (€)"  type="number" value={margin}  onChange={(e) => setMargin(e.target.value)} />
          <Button size="sm" loading={saving} onClick={handleSave}>Сохранить</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Отмена</Button>
        </div>
      ) : Number(planRevenue) === 0 ? (
        <p className="text-body text-gray-500">План на этот месяц не задан.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-gray-500">Доход</span>
            <span className="text-gray-900 tabular-nums font-medium">
              {formatMoney(factRevenue)} <span className="text-gray-500">/ {formatMoney(planRevenue)}</span>
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${revenuePctExact >= 100 ? 'bg-success' : 'bg-gold'}`}
              style={{ width: `${revenuePct}%` }}
            />
          </div>
          <p className="text-label text-gray-500">{revenuePctExact.toFixed(0)}% от плана</p>

          {Number(planMargin) > 0 && (
            <p className="text-label text-gray-500 pt-1">
              Маржа: {formatMoney(factMargin)} / {formatMoney(planMargin)} план
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
