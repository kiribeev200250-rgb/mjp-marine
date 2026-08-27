'use client'

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { formatMoney, isNegativeMoney } from '@/lib/crm/utils'
import type { FinanceEntryType } from '@prisma/client'

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

export interface PLCategory {
  id:   string
  kind: 'INCOME' | 'EXPENSE'
  name: string
}

export interface PLEntry {
  id:            string
  categoryId:    string | null
  category:      string
  type:          FinanceEntryType
  amount:        string
  date:          string // ISO
  autoId:        string
  description:   string
  paymentMethod: string
}

interface Props {
  categories: PLCategory[]
  entries:    PLEntry[]
}

interface DrillState {
  label: string
  items: PLEntry[]
}

// Возвращает ключ ячейки: категория (по id, либо по строке для legacy-записей
// без categoryId) × месяц. ФОТ — отдельный псевдо-ключ "SALARY".
function cellKey(catKey: string, month: number) {
  return `${catKey}|${month}`
}

export function PLGrid({ categories, entries }: Props) {
  const [drill, setDrill] = useState<DrillState | null>(null)

  const incomeCats  = useMemo(() => categories.filter((c) => c.kind === 'INCOME'),  [categories])
  const expenseCats = useMemo(() => categories.filter((c) => c.kind === 'EXPENSE'), [categories])

  // categoryKey: categoryId, если есть, иначе "name:<строка>" — легаси-записи
  // без связи всё равно попадают в свою колонку по имени, а не теряются.
  function catKeyOf(e: PLEntry): string {
    return e.categoryId ?? `name:${e.category}`
  }

  const { byCell, monthSalary, monthIncomeTotal, monthExpenseTotal } = useMemo(() => {
    const byCell = new Map<string, PLEntry[]>()
    const monthSalary: PLEntry[][] = Array.from({ length: 12 }, () => [])
    const monthIncomeTotal: Decimal[] = Array.from({ length: 12 }, () => new Decimal(0))
    const monthExpenseTotal: Decimal[] = Array.from({ length: 12 }, () => new Decimal(0))

    for (const e of entries) {
      const month = new Date(e.date).getMonth()
      const amt = new Decimal(e.amount)
      if (e.type === 'SALARY') {
        monthSalary[month].push(e)
        continue
      }
      const key = cellKey(catKeyOf(e), month)
      if (!byCell.has(key)) byCell.set(key, [])
      byCell.get(key)!.push(e)
      if (e.type === 'INCOME') monthIncomeTotal[month] = monthIncomeTotal[month].plus(amt)
      if (e.type === 'EXPENSE') monthExpenseTotal[month] = monthExpenseTotal[month].plus(amt)
    }
    return { byCell, monthSalary, monthIncomeTotal, monthExpenseTotal }
  }, [entries])

  function itemsFor(catKey: string, month: number): PLEntry[] {
    return byCell.get(cellKey(catKey, month)) ?? []
  }
  function sumFor(catKey: string, month: number): Decimal {
    return itemsFor(catKey, month).reduce((s, e) => s.plus(e.amount), new Decimal(0))
  }
  function yearSum(items: (m: number) => Decimal): Decimal {
    let s = new Decimal(0)
    for (let m = 0; m < 12; m++) s = s.plus(items(m))
    return s
  }

  const monthSalaryTotal = monthSalary.map((rows) => rows.reduce((s, e) => s.plus(e.amount), new Decimal(0)))
  const monthProfit = Array.from({ length: 12 }, (_, m) =>
    monthIncomeTotal[m].minus(monthExpenseTotal[m]).minus(monthSalaryTotal[m]),
  )

  const yearIncome  = yearSum((m) => monthIncomeTotal[m])
  const yearExpense = yearSum((m) => monthExpenseTotal[m])
  const yearSalary  = yearSum((m) => monthSalaryTotal[m])
  const yearProfit  = yearIncome.minus(yearExpense).minus(yearSalary)

  function openDrill(label: string, items: PLEntry[]) {
    if (items.length === 0) return
    setDrill({ label, items })
  }

  function Cell({ catKey, month, label }: { catKey: string; month: number; label: string }) {
    const items = itemsFor(catKey, month)
    const sum = items.reduce((s, e) => s.plus(e.amount), new Decimal(0))
    return (
      <td
        className={`px-2.5 py-1.5 text-right tabular-nums text-body border-l border-gray-100 ${
          items.length > 0 ? 'cursor-pointer hover:bg-info/10 transition' : 'text-gray-500'
        }`}
        onClick={() => openDrill(label, items)}
      >
        {items.length > 0 ? formatMoney(sum) : '—'}
      </td>
    )
  }

  function CategoryRow({ cat }: { cat: PLCategory }) {
    const rowTotal = Array.from({ length: 12 }, (_, m) => sumFor(cat.id, m)).reduce((s, v) => s.plus(v), new Decimal(0))
    const yearItems = entries.filter((e) => catKeyOf(e) === cat.id)
    return (
      <tr className="border-b border-gray-50 hover:bg-gray-50/40 transition">
        <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-body text-gray-900 whitespace-nowrap">{cat.name}</td>
        {Array.from({ length: 12 }, (_, m) => (
          <Cell key={m} catKey={cat.id} month={m} label={`${cat.name} · ${MONTHS_SHORT[m]}`} />
        ))}
        <td
          className={`px-2.5 py-1.5 text-right tabular-nums text-body font-medium border-l-2 border-gray-200 ${
            yearItems.length > 0 ? 'cursor-pointer hover:bg-info/10 transition' : 'text-gray-500'
          }`}
          onClick={() => openDrill(`${cat.name} · за год`, yearItems)}
        >
          {rowTotal.gt(0) ? formatMoney(rowTotal) : '—'}
        </td>
      </tr>
    )
  }

  return (
    <div className="relative">
      <div className="overflow-auto max-h-[70vh] rounded-card border border-gray-200">
        <table className="border-collapse text-body">
          <thead>
            <tr className="bg-navy-900">
              <th className="sticky left-0 top-0 z-30 bg-navy-900 px-3 py-2 text-left text-label text-white/70 uppercase tracking-wide font-semibold whitespace-nowrap">
                Категория
              </th>
              {MONTHS_SHORT.map((m) => (
                <th key={m} className="sticky top-0 z-20 bg-navy-900 px-2.5 py-2 text-right text-label text-white/70 uppercase tracking-wide font-semibold min-w-[84px]">
                  {m}
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-navy-900 px-2.5 py-2 text-right text-label text-gold uppercase tracking-wide font-bold min-w-[96px] border-l-2 border-white/10">
                Итого
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={14} className="sticky left-0 bg-success/10 px-3 py-1 text-label text-success font-bold uppercase tracking-wide">
                Доходы
              </td>
            </tr>
            {incomeCats.map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
            <tr className="bg-success/5 border-y border-success/20 font-semibold">
              <td className="sticky left-0 z-10 bg-success/5 px-3 py-1.5 text-body text-gray-900">Итого доходы</td>
              {Array.from({ length: 12 }, (_, m) => (
                <td key={m} className="px-2.5 py-1.5 text-right tabular-nums text-body text-gray-900 border-l border-gray-100">
                  {monthIncomeTotal[m].gt(0) ? formatMoney(monthIncomeTotal[m]) : '—'}
                </td>
              ))}
              <td className="px-2.5 py-1.5 text-right tabular-nums text-body text-gray-900 border-l-2 border-gray-200">
                {formatMoney(yearIncome)}
              </td>
            </tr>

            <tr>
              <td colSpan={14} className="sticky left-0 bg-danger/10 px-3 py-1 text-label text-danger font-bold uppercase tracking-wide">
                Расходы
              </td>
            </tr>
            {expenseCats.map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
            <tr className="bg-danger/5 border-y border-danger/20 font-semibold">
              <td className="sticky left-0 z-10 bg-danger/5 px-3 py-1.5 text-body text-gray-900">Итого расходы</td>
              {Array.from({ length: 12 }, (_, m) => (
                <td key={m} className="px-2.5 py-1.5 text-right tabular-nums text-body text-gray-900 border-l border-gray-100">
                  {monthExpenseTotal[m].gt(0) ? formatMoney(monthExpenseTotal[m]) : '—'}
                </td>
              ))}
              <td className="px-2.5 py-1.5 text-right tabular-nums text-body text-gray-900 border-l-2 border-gray-200">
                {formatMoney(yearExpense)}
              </td>
            </tr>

            <tr className="border-b border-gray-100 hover:bg-gray-50/40 transition">
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-body text-gray-900 font-medium">Зарплаты (ФОТ)</td>
              {Array.from({ length: 12 }, (_, m) => {
                const items = monthSalary[m]
                return (
                  <td
                    key={m}
                    className={`px-2.5 py-1.5 text-right tabular-nums text-body border-l border-gray-100 ${
                      items.length > 0 ? 'cursor-pointer hover:bg-info/10 transition' : 'text-gray-500'
                    }`}
                    onClick={() => openDrill(`ФОТ · ${MONTHS_SHORT[m]}`, items)}
                  >
                    {items.length > 0 ? formatMoney(monthSalaryTotal[m]) : '—'}
                  </td>
                )
              })}
              <td
                className="px-2.5 py-1.5 text-right tabular-nums text-body font-medium border-l-2 border-gray-200 cursor-pointer hover:bg-info/10 transition"
                onClick={() => openDrill('ФОТ · за год', monthSalary.flat())}
              >
                {formatMoney(yearSalary)}
              </td>
            </tr>

            <tr className="bg-navy-900 font-bold">
              <td className="sticky left-0 z-10 bg-navy-900 px-3 py-2.5 text-body text-white uppercase tracking-wide">Прибыль / убыток</td>
              {monthProfit.map((p, m) => (
                <td key={m} className={`px-2.5 py-2.5 text-right tabular-nums text-body border-l border-white/10 ${isNegativeMoney(p) ? 'text-danger' : 'text-gold'}`}>
                  {formatMoney(p)}
                </td>
              ))}
              <td className={`px-2.5 py-2.5 text-right tabular-nums text-subheading border-l-2 border-white/10 ${isNegativeMoney(yearProfit) ? 'text-danger' : 'text-gold'}`}>
                {formatMoney(yearProfit)}
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
                      <span className="text-label text-gray-500 font-mono">{e.autoId}</span>
                    </div>
                    <p className="text-label text-gray-500 mt-0.5">
                      {new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(e.date))}
                      {e.paymentMethod ? ` · ${e.paymentMethod}` : ''}
                    </p>
                    {e.description && <p className="text-label text-gray-700 mt-1">{e.description}</p>}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
