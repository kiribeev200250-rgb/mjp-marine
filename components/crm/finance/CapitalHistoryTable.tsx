import { formatMoney } from '@/lib/crm/utils'
import { Badge } from '@/components/crm/ui'
import { ReverseEntryButton } from './ReverseEntryButton'
import Decimal from 'decimal.js'

interface CapitalRow {
  id:           string
  autoId:       string
  type:         string
  date:         Date
  source:       string
  amount:       unknown
  note:         string
  reversalOfId: string | null
}

const TYPE_RU: Record<string, string> = {
  REINVESTMENT:  'Доинвестиция',
  STARTUP_ASSET: 'Стартовый актив',
  STARTUP_SUNK:  'Стартовый невозвратный',
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(d)
}

export function CapitalHistoryTable({ entries }: { entries: CapitalRow[] }) {
  return (
    <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-subheading font-bold text-gray-900">История вложений капитала</h2>
        <p className="text-label text-gray-500 mt-0.5">Не входит в P&L — доинвестиции и стартовые активы</p>
      </div>
      {entries.length === 0 ? (
        <p className="text-body text-gray-500 text-center py-10">Вложений нет</p>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {entries.map((e) => {
            const amt = new Decimal((e.amount as { toString(): string }).toString())
            const isReversal = amt.isNegative()
            return (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isReversal ? 'bg-warning' : 'bg-info'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-gray-900 truncate">
                    {TYPE_RU[e.type] ?? e.type}{isReversal ? ' · сторно' : ''}
                  </p>
                  <p className="text-label text-gray-500 truncate">
                    {fmtDate(e.date)}{e.source ? ` · ${e.source}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-body font-semibold tabular-nums ${amt.isNegative() ? 'text-danger' : 'text-gray-900'}`}>
                    {amt.isNegative() ? '−' : '+'}{formatMoney(amt.abs())}
                  </span>
                  <span className="text-label text-gray-500 font-mono">{e.autoId}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {!e.reversalOfId && <ReverseEntryButton endpoint={`/api/crm/capital/${e.id}/reverse`} label={`вложение ${e.autoId}`} />}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
