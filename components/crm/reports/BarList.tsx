import { formatMoney } from '@/lib/crm/utils'

interface BarListItem { label: string; amount: number }

interface Props {
  items:    BarListItem[]
  barColor?: string
  emptyText?: string
}

export function BarList({ items, barColor = 'bg-gold', emptyText = 'Нет данных' }: Props) {
  const max = Math.max(...items.map((i) => i.amount), 1)

  if (items.length === 0) {
    return <p className="text-body text-gray-500 text-center py-6">{emptyText}</p>
  }

  return (
    <div className="space-y-3">
      {items.map(({ label, amount }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-body text-gray-700 truncate max-w-[65%]">{label}</span>
            <span className="text-body text-gray-900 tabular-nums font-medium">{formatMoney(amount)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${(amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
