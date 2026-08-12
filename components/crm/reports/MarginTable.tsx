import { formatMoney } from '@/lib/crm/utils'
import type { MarginRow } from '@/lib/crm/services/profitability'

interface Props {
  rows:       MarginRow[]
  labelHeader: string
  limit?:     number
  emptyText?: string
}

// Плотная числовая таблица прибыльности — tabular-nums на всех суммах, чтобы
// колонки не «плясали», выравнивание по правому краю для чисел.
export function MarginTable({ rows, labelHeader, limit = 8, emptyText = 'Нет данных за период' }: Props) {
  if (rows.length === 0) {
    return <p className="text-body text-gray-500 text-center py-6">{emptyText}</p>
  }

  const shown = rows.slice(0, limit)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-2 py-2 text-left text-label text-gray-500 uppercase tracking-wide font-semibold">{labelHeader}</th>
            <th className="px-2 py-2 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Выручка</th>
            <th className="px-2 py-2 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Материалы</th>
            <th className="px-2 py-2 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">Маржа</th>
            <th className="px-2 py-2 text-right text-label text-gray-500 uppercase tracking-wide font-semibold">%</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-b border-gray-100 last:border-0">
              <td className="px-2 py-2 text-body text-gray-900 truncate max-w-[220px]">{r.label}</td>
              <td className="px-2 py-2 text-body text-gray-900 text-right tabular-nums">{formatMoney(r.revenueNet)}</td>
              <td className="px-2 py-2 text-body text-gray-500 text-right tabular-nums">{formatMoney(r.materialCost)}</td>
              <td className={`px-2 py-2 text-body text-right tabular-nums font-semibold ${r.margin.isNegative() ? 'text-danger' : 'text-success'}`}>
                {formatMoney(r.margin)}
              </td>
              <td className={`px-2 py-2 text-body text-right tabular-nums ${r.margin.isNegative() ? 'text-danger' : 'text-gray-500'}`}>
                {r.marginPct != null ? `${r.marginPct.toFixed(0)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <p className="text-label text-gray-500 text-center pt-2">и ещё {rows.length - limit}…</p>
      )}
    </div>
  )
}
