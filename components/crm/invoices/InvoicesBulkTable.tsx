'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, Button, ExportCsvButton, INVOICE_TONE } from '@/components/crm/ui'
import { formatMoney, INVOICE_STATUS_LABELS } from '@/lib/crm/utils'

export interface InvoiceRow {
  id:         string
  number:     string
  clientId:   string
  clientName: string
  date:       string
  total:      number
  status:     string
  isDraft:    boolean
}

const PAYABLE = new Set(['ISSUED', 'PARTIAL', 'OVERDUE'])

export function InvoicesBulkTable({ rows }: { rows: InvoiceRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const payableSelected = rows.filter((r) => selected.has(r.id) && PAYABLE.has(r.status))
  const allPayableIds = rows.filter((r) => PAYABLE.has(r.status)).map((r) => r.id)
  const allPayableSelected = allPayableIds.length > 0 && allPayableIds.every((id) => selected.has(id))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allPayableSelected ? new Set() : new Set(allPayableIds))
  }

  const bulkPay = async () => {
    if (payableSelected.length === 0) return
    setError(null)
    setPaying(true)
    try {
      const res = await fetch('/api/crm/invoices/bulk-pay', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: payableSelected.map((r) => r.id) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка'); return }
      setSelected(new Set())
      router.refresh()
    } finally {
      setPaying(false)
    }
  }

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const csvHeaders = ['Номер', 'Клиент', 'Дата', 'Сумма', 'Статус']
  const csvSelectedRows = selectedRows.map((r) => [r.number, r.clientName, r.date, r.total, INVOICE_STATUS_LABELS[r.status as keyof typeof INVOICE_STATUS_LABELS] ?? r.status])

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-navy-900 text-white rounded-card px-4 py-2.5">
          <span className="text-body font-medium">Выбрано: {selected.size}</span>
          <Button size="sm" disabled={paying || payableSelected.length === 0} onClick={bulkPay}>
            {paying ? 'Провожу…' : `Пометить оплаченными (${payableSelected.length})`}
          </Button>
          <ExportCsvButton filename="invoices-selected" headers={csvHeaders} rows={csvSelectedRows} />
          <button onClick={() => setSelected(new Set())} className="ml-auto text-label text-white/60 hover:text-white transition">
            Снять выделение
          </button>
        </div>
      )}
      {error && <p className="text-body text-danger">{error}</p>}

      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 w-8">
                  <input type="checkbox" checked={allPayableSelected} onChange={toggleAll} disabled={allPayableIds.length === 0} />
                </th>
                <th className="px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold text-left">Номер</th>
                <th className="px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold text-left">Клиент</th>
                <th className="px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold text-left">Дата</th>
                <th className="px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold text-right">Сумма</th>
                <th className="px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold text-left">Статус</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="text-3xl mb-2">🧾</div>
                    <p className="text-body text-gray-500">Счетов пока нет</p>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-200 last:border-0 hover:bg-gray-50/70 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        disabled={!PAYABLE.has(r.status)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-body">
                      <Link href={`/crm/invoices/${r.id}`} className="font-mono text-gray-900 hover:text-gold transition">{r.number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-body">
                      <Link href={`/crm/clients/${r.clientId}`} className="text-gray-900 hover:text-gold transition">{r.clientName}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-body text-gray-900">{r.date}</td>
                    <td className="px-4 py-2.5 text-body text-right tabular-nums font-medium">{formatMoney(r.total)}</td>
                    <td className="px-4 py-2.5 text-body">
                      <Badge tone={INVOICE_TONE[r.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[r.status as keyof typeof INVOICE_STATUS_LABELS] ?? r.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-body text-right">
                      {r.isDraft && (
                        <Link href={`/crm/invoices/${r.id}/edit`} className="text-gray-500 hover:text-gold transition text-label">✏ Редактировать</Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
