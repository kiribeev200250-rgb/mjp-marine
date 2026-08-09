import { cn } from '@/lib/crm/utils'

export interface Column<T> {
  key:      string
  header:   string
  render:   (row: T) => React.ReactNode
  align?:   'left' | 'right' | 'center'
  width?:   string
}

interface Props<T> {
  columns:    Column<T>[]
  rows:       T[]
  keyField:   keyof T
  emptyText?: string
  emptyIcon?: string
  loading?:   boolean
  footer?:    React.ReactNode
  className?: string
}

const ALIGN: Record<string, string> = {
  left:   'text-left',
  right:  'text-right',
  center: 'text-center',
}

export function DataTable<T>({
  columns, rows, keyField, emptyText = 'Нет данных', emptyIcon = '📋',
  loading, footer, className,
}: Props<T>) {
  return (
    <div className={cn('bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold',
                    ALIGN[col.align ?? 'left'],
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-200 last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5">
                      <div className="h-4 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">{emptyIcon}</div>
                  <p className="text-body text-gray-500">{emptyText}</p>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={String(row[keyField])}
                  className={cn(
                    'border-b border-gray-200 last:border-0 transition-colors',
                    'hover:bg-gray-50/70',
                    i % 2 === 1 && 'bg-gray-50/30',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 text-body text-gray-900',
                        ALIGN[col.align ?? 'left'],
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/50">
          {footer}
        </div>
      )}
    </div>
  )
}