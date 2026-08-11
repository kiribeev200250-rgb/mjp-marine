'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Decimal from 'decimal.js'
import { formatMoney, isNegativeMoney } from '@/lib/crm/utils'

export interface VatEntryRow {
  id:            string
  direction:     'REPERCUTIDO' | 'SOPORTADO'
  date:          string // ISO
  amount:        string
  baseAmount:    string
  rate:          string
  note:          string
  invoiceId:     string | null
  invoiceNumber: string | null
  financeAutoId: string | null
}

interface Props { entries: VatEntryRow[] }

interface DrillState { label: string; items: VatEntryRow[] }

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

export function VatGrid({ entries }: Props) {
  const [drill, setDrill] = useState<DrillState | null>(null)

  const { byQuarter, repercutidoTotal, soportadoTotal } = useMemo(() => {
    const byQuarter: { repercutido: VatEntryRow[]; soportado: VatEntryRow[] }[] =
      Array.from({ length: 4 }, () => ({ repercutido: [], soportado: [] }))
    for (const e of entries) {
      const q = Math.floor(new Date(e.date).getMonth() / 3)
      if (e.direction === 'REPERCUTIDO') byQuarter[q].repercutido.push(e)
      else byQuarter[q].soportado.push(e)
    }
    const sum = (rows: VatEntryRow[]) => rows.reduce((s, e) => s.plus(e.amount), new Decimal(0))
    const repercutidoTotal = byQuarter.reduce((s, q) => s.plus(sum(q.repercutido)), new Decimal(0))
    const soportadoTotal   = byQuarter.reduce((s, q) => s.plus(sum(q.soportado)), new Decimal(0))
    return { byQuarter, repercutidoTotal, soportadoTotal }
  }, [entries])

  function sumOf(rows: VatEntryRow[]) {
    return rows.reduce((s, e) => s.plus(e.amount), new Decimal(0))
  }

  function openDrill(label: string, items: VatEntryRow[]) {
    if (items.length === 0) return
    setDrill({ label, items })
  }

  function Cell({ rows, label }: { rows: VatEntryRow[]; label: string }) {
    const sum = sumOf(rows)
    return (
      <td
        className={`px-3 py-1.5 text-right tabular-nums text-body border-l border-gray-100 ${
          rows.length > 0 ? 'cursor-pointer hover:bg-info/10 transition' : 'text-gray-500'
        }`}
        onClick={() => openDrill(label, rows)}
      >
        {rows.length > 0 ? formatMoney(sum) : '—'}
      </td>
    )
  }

  return (
    <div className="relative">
      <div className="overflow-auto rounded-card border border-gray-200">
        <table className="border-collapse text-body w-full">
          <thead>
            <tr className="bg-navy-900">
              <th className="sticky left-0 bg-navy-900 px-3 py-2 text-left text-label text-white/70 uppercase tracking-wide font-semibold whitespace-nowrap">
                {' '}
              </th>
              {QUARTER_LABELS.map((q) => (
                <th key={q} className="px-3 py-2 text-right text-label text-white/70 uppercase tracking-wide font-semibold min-w-[100px]">
                  {q}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-label text-gold uppercase tracking-wide font-bold min-w-[110px] border-l-2 border-white/10">
                За год
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50 hover:bg-gray-50/40 transition">
              <td className="sticky left-0 bg-white px-3 py-1.5 text-body text-gray-700 whitespace-nowrap">IVA собранный (repercutido)</td>
              {byQuarter.map((q, i) => (
                <Cell key={i} rows={q.repercutido} label={`Repercutido · ${QUARTER_LABELS[i]}`} />
              ))}
              <td
                className="px-3 py-1.5 text-right tabular-nums text-body font-medium border-l-2 border-gray-200 cursor-pointer hover:bg-info/10 transition"
                onClick={() => openDrill('Repercutido · за год', entries.filter((e) => e.direction === 'REPERCUTIDO'))}
              >
                {formatMoney(repercutidoTotal)}
              </td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50/40 transition">
              <td className="sticky left-0 bg-white px-3 py-1.5 text-body text-gray-700 whitespace-nowrap">IVA уплаченный (soportado)</td>
              {byQuarter.map((q, i) => (
                <Cell key={i} rows={q.soportado} label={`Soportado · ${QUARTER_LABELS[i]}`} />
              ))}
              <td
                className="px-3 py-1.5 text-right tabular-nums text-body font-medium border-l-2 border-gray-200 cursor-pointer hover:bg-info/10 transition"
                onClick={() => openDrill('Soportado · за год', entries.filter((e) => e.direction === 'SOPORTADO'))}
              >
                {formatMoney(soportadoTotal)}
              </td>
            </tr>
            <tr className="bg-navy-900 font-bold">
              <td className="sticky left-0 bg-navy-900 px-3 py-2.5 text-body text-white uppercase tracking-wide whitespace-nowrap">IVA к уплате</td>
              {byQuarter.map((q, i) => {
                const due = sumOf(q.repercutido).minus(sumOf(q.soportado))
                return (
                  <td key={i} className={`px-3 py-2.5 text-right tabular-nums text-body border-l border-white/10 ${isNegativeMoney(due) ? 'text-danger' : 'text-gold'}`}>
                    {formatMoney(due)}
                  </td>
                )
              })}
              <td className={`px-3 py-2.5 text-right tabular-nums text-subheading border-l-2 border-white/10 ${isNegativeMoney(repercutidoTotal.minus(soportadoTotal)) ? 'text-danger' : 'text-gold'}`}>
                {formatMoney(repercutidoTotal.minus(soportadoTotal))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/20" onClick={() => setDrill(null)}>
          <div className="bg-white h-full w-full max-w-md shadow-e4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-subheading font-bold text-gray-900">{drill.label}</h3>
                <p className="text-label text-gray-500 mt-0.5">{drill.items.length} операц{drill.items.length === 1 ? 'ия' : 'ий'}</p>
              </div>
              <button onClick={() => setDrill(null)} className="text-gray-500 hover:text-gray-900 text-body transition">✕</button>
            </div>
            <div className="divide-y divide-gray-100">
              {drill.items
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((e) => (
                  <div key={e.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-medium text-gray-900">{formatMoney(e.amount)}</span>
                      <span className="text-label text-gray-500">база {formatMoney(e.baseAmount)} · {e.rate}%</span>
                    </div>
                    <p className="text-label text-gray-500 mt-0.5">
                      {new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(e.date))}
                    </p>
                    {e.invoiceId && e.invoiceNumber && (
                      <Link href={`/crm/invoices/${e.invoiceId}`} className="text-label text-gold hover:underline mt-1 inline-block">
                        Счёт {e.invoiceNumber}
                      </Link>
                    )}
                    {e.financeAutoId && <p className="text-label text-gray-700 mt-1">{e.financeAutoId}{e.note ? ` · ${e.note}` : ''}</p>}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
