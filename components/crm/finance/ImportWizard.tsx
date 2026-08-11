'use client'

import { useMemo, useState } from 'react'
import type { CapitalEntryType } from '@prisma/client'
import { Button, Card, SectionHeader, DataTable, Badge } from '@/components/crm/ui'
import type { Column } from '@/components/crm/ui'
import { CategoryCombobox, type CategoryOption } from './CategoryCombobox'
import { formatMoney } from '@/lib/crm/utils'
import Decimal from 'decimal.js'

// ── Типы превью, зеркалят ответ /api/crm/finance/import/parse ─────────────

type ImportSheetKind = 'EXPENSE' | 'INCOME' | 'SALARY' | 'INVESTMENT'

interface RowBase {
  rowNumber: number
  importRef: string | null
  errors: string[]
  duplicate: boolean
  date: string | null
  amount: string | null
}
interface ExpenseRow extends RowBase { category: string; description: string; paymentMethod: string; suggestedCategoryId: string | null }
interface IncomeRow extends RowBase { clientBoat: string; workType: string; marina: string; employee: string; suggestedCategoryId: string | null }
interface SalaryRow extends RowBase { employee: string; position: string; paymentMethod: string; note: string; suggestedCategoryId: string | null }
interface InvestmentRow extends RowBase { source: string; capitalType: CapitalEntryType | null; capitalTypeRaw: string; purpose: string; note: string }

interface ParsedSheet<T> { sheetName: string; found: boolean; rows: T[]; kpiTotals: Record<string, string> }

interface ParsePreview {
  expenses: ParsedSheet<ExpenseRow>
  income: ParsedSheet<IncomeRow>
  salaries: ParsedSheet<SalaryRow>
  investments: ParsedSheet<InvestmentRow>
  categories: { income: CategoryOption[]; expense: CategoryOption[]; salary: CategoryOption[] }
}

interface CommitResult {
  created: number
  skippedDuplicate: number
  errors: { importRef: string; error: string }[]
  reconciliation: Record<string, string>
}

const SHEET_TABS: { key: ImportSheetKind; label: string }[] = [
  { key: 'EXPENSE',    label: 'Расходы' },
  { key: 'INCOME',     label: 'Доходы' },
  { key: 'SALARY',     label: 'Зарплаты' },
  { key: 'INVESTMENT', label: 'Инвестиции' },
]

const CAPITAL_TYPE_LABEL: Record<CapitalEntryType, string> = {
  REINVESTMENT:  'Доинвестиции',
  STARTUP_ASSET: 'Стартовые',
  STARTUP_SUNK:  'Стартовые невозвратные',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

export function ImportWizard() {
  const [file, setFile]           = useState<File | null>(null)
  const [parsing, setParsing]     = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview]     = useState<ParsePreview | null>(null)
  const [activeSheet, setActiveSheet] = useState<ImportSheetKind>('EXPENSE')

  // categoryMap[sheet][сырое значение из книги] = выбранная категория CRM (или null — ещё не выбрана)
  const [categoryMap, setCategoryMap] = useState<Record<string, Record<string, CategoryOption | null>>>({})

  const [committing, setCommitting] = useState(false)
  const [commitResults, setCommitResults] = useState<Record<ImportSheetKind, CommitResult | null>>({
    EXPENSE: null, INCOME: null, SALARY: null, INVESTMENT: null,
  })
  const [commitError, setCommitError] = useState<string | null>(null)

  async function handleParse() {
    if (!file) return
    setParsing(true)
    setParseError(null)
    setPreview(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/crm/finance/import/parse', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка разбора файла')
      setPreview(data as ParsePreview)

      // Инициализация маппинга категорий предложенными совпадениями
      const initMap: Record<string, Record<string, CategoryOption | null>> = {
        EXPENSE: {}, INCOME: {}, SALARY: {}, INVESTMENT: {},
      }
      const fill = (rows: { category?: string; workType?: string; employee?: string; suggestedCategoryId: string | null }[],
                    key: 'category' | 'workType' | 'employee', sheet: ImportSheetKind, cats: CategoryOption[]) => {
        for (const r of rows) {
          const raw = (r as unknown as Record<string, string>)[key]?.trim()
          if (!raw || initMap[sheet][raw]) continue
          const match = r.suggestedCategoryId ? cats.find((c) => c.id === r.suggestedCategoryId) ?? null : null
          initMap[sheet][raw] = match
        }
      }
      fill(data.expenses.rows, 'category', 'EXPENSE', data.categories.expense)
      fill(data.income.rows, 'workType', 'INCOME', data.categories.income)
      fill(data.salaries.rows, 'employee', 'SALARY', data.categories.salary)
      setCategoryMap(initMap)
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'Ошибка разбора файла')
    } finally {
      setParsing(false)
    }
  }

  const sheetData = preview ? {
    EXPENSE:    preview.expenses,
    INCOME:     preview.income,
    SALARY:     preview.salaries,
    INVESTMENT: preview.investments,
  }[activeSheet] : null

  const rawKeyField: Record<ImportSheetKind, 'category' | 'workType' | 'employee' | null> = {
    EXPENSE: 'category', INCOME: 'workType', SALARY: 'employee', INVESTMENT: null,
  }
  const categoryKind: Record<ImportSheetKind, 'EXPENSE' | 'INCOME' | 'SALARY' | null> = {
    EXPENSE: 'EXPENSE', INCOME: 'INCOME', SALARY: 'SALARY', INVESTMENT: null,
  }
  const categoriesForSheet: Record<ImportSheetKind, CategoryOption[]> = preview ? {
    EXPENSE: preview.categories.expense, INCOME: preview.categories.income, SALARY: preview.categories.salary, INVESTMENT: [],
  } : { EXPENSE: [], INCOME: [], SALARY: [], INVESTMENT: [] }

  const uniqueRawValues = useMemo(() => {
    if (!sheetData || !rawKeyField[activeSheet]) return []
    const key = rawKeyField[activeSheet]!
    const set = new Set<string>()
    for (const r of sheetData.rows) {
      const v = (r as unknown as Record<string, string>)[key]?.trim()
      if (v) set.add(v)
    }
    return [...set].sort()
  }, [sheetData, activeSheet])

  const stats = useMemo(() => {
    if (!sheetData) return null
    const total = sheetData.rows.length
    const withErrors = sheetData.rows.filter((r) => r.errors.length > 0).length
    const duplicates = sheetData.rows.filter((r) => r.duplicate && r.errors.length === 0).length
    const readyNew = total - withErrors - duplicates
    return { total, withErrors, duplicates, readyNew }
  }, [sheetData])

  function categoryReady(): boolean {
    if (!rawKeyField[activeSheet]) return true
    const map = categoryMap[activeSheet] ?? {}
    return uniqueRawValues.every((v) => map[v] != null)
  }

  async function handleCommit() {
    if (!sheetData) return
    setCommitting(true)
    setCommitError(null)
    try {
      const key = rawKeyField[activeSheet]
      const map = categoryMap[activeSheet] ?? {}

      const rows = sheetData.rows
        .filter((r) => r.errors.length === 0)
        .map((r) => {
          if (activeSheet === 'INVESTMENT') {
            const ir = r as InvestmentRow
            return {
              importRef: ir.importRef,
              date: ir.date,
              amount: ir.amount,
              capitalType: ir.capitalType,
              description: ir.source,
              note: [ir.purpose, ir.note].filter(Boolean).join(' — '),
            }
          }
          const raw = key ? (r as unknown as Record<string, string>)[key]?.trim() : ''
          const chosen = raw ? map[raw] : null
          let description = ''
          let paymentMethod = ''
          if (activeSheet === 'EXPENSE') {
            const er = r as ExpenseRow
            description = er.description
            paymentMethod = er.paymentMethod
          } else if (activeSheet === 'INCOME') {
            const inr = r as IncomeRow
            description = [inr.clientBoat, inr.marina, inr.employee].filter(Boolean).join(' — ')
          } else if (activeSheet === 'SALARY') {
            const sr = r as SalaryRow
            description = [sr.position, sr.note].filter(Boolean).join(' — ')
            paymentMethod = sr.paymentMethod
          }
          return {
            importRef: r.importRef,
            date: r.date,
            amount: r.amount,
            categoryId: chosen?.id ?? null,
            categoryName: chosen ? null : raw,
            description,
            paymentMethod,
          }
        })

      const res = await fetch('/api/crm/finance/import/commit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sheet: activeSheet, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка импорта')
      setCommitResults((prev) => ({ ...prev, [activeSheet]: data as CommitResult }))
    } catch (e: unknown) {
      setCommitError(e instanceof Error ? e.message : 'Ошибка импорта')
    } finally {
      setCommitting(false)
    }
  }

  const columns: Column<RowBase>[] = useMemo(() => {
    const base: Column<RowBase>[] = [
      { key: 'importRef', header: 'ID', render: (r) => r.importRef ?? '—', width: '90px' },
      { key: 'date', header: 'Дата', render: (r) => fmtDate(r.date), width: '110px' },
    ]
    if (activeSheet === 'EXPENSE') {
      base.push(
        { key: 'category', header: 'Категория', render: (r) => (r as ExpenseRow).category },
        { key: 'description', header: 'Описание', render: (r) => (r as ExpenseRow).description },
        { key: 'paymentMethod', header: 'Оплата', render: (r) => (r as ExpenseRow).paymentMethod, width: '110px' },
      )
    } else if (activeSheet === 'INCOME') {
      base.push(
        { key: 'workType', header: 'Вид работы', render: (r) => (r as IncomeRow).workType },
        { key: 'clientBoat', header: 'Клиент / Яхта', render: (r) => (r as IncomeRow).clientBoat },
        { key: 'marina', header: 'Марина', render: (r) => (r as IncomeRow).marina, width: '110px' },
      )
    } else if (activeSheet === 'SALARY') {
      base.push(
        { key: 'employee', header: 'Сотрудник', render: (r) => (r as SalaryRow).employee },
        { key: 'position', header: 'Должность', render: (r) => (r as SalaryRow).position },
      )
    } else {
      base.push(
        { key: 'capitalTypeRaw', header: 'Тип', render: (r) => (r as InvestmentRow).capitalTypeRaw },
        { key: 'source', header: 'Источник', render: (r) => (r as InvestmentRow).source },
        { key: 'purpose', header: 'Назначение', render: (r) => (r as InvestmentRow).purpose },
      )
    }
    base.push(
      { key: 'amount', header: 'Сумма', align: 'right', render: (r) => (r.amount ? formatMoney(r.amount) : '—'), width: '110px' },
      {
        key: 'status', header: 'Статус', width: '140px',
        render: (r) => {
          if (r.errors.length) return <Badge tone="danger">{r.errors[0]}</Badge>
          if (r.duplicate) return <Badge tone="warning">Уже импортирован</Badge>
          return <Badge tone="success">Новая</Badge>
        },
      },
    )
    return base
  }, [activeSheet])

  const activeResult = commitResults[activeSheet]

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Файл книги" />
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-body text-gray-900 file:mr-3 file:rounded-control file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-body file:font-medium file:text-gray-900 hover:file:bg-gray-200"
          />
          <Button onClick={handleParse} disabled={!file || parsing} loading={parsing}>
            Разобрать файл
          </Button>
        </div>
        {parseError && <p className="text-body text-danger mt-3">{parseError}</p>}
        <p className="text-label text-gray-500 mt-3">
          Импорт одностороннний: книга → CRM. Загруженные данные никогда не синхронизируются обратно в таблицу.
        </p>
      </Card>

      {preview && (
        <>
          <div className="flex gap-2 flex-wrap">
            {SHEET_TABS.map((tab) => {
              const sd = { EXPENSE: preview.expenses, INCOME: preview.income, SALARY: preview.salaries, INVESTMENT: preview.investments }[tab.key]
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveSheet(tab.key)}
                  className={
                    'px-4 py-2 rounded-control text-body font-medium transition border ' +
                    (activeSheet === tab.key
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50')
                  }
                >
                  {tab.label} <span className="text-label opacity-70">({sd.rows.length})</span>
                </button>
              )
            })}
          </div>

          {sheetData && stats && (
            <Card>
              <SectionHeader title={`Итоги в книге — лист «${sheetData.sheetName}»`} />
              <div className="flex gap-6 flex-wrap mb-4">
                {Object.entries(sheetData.kpiTotals).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-label text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="text-body text-gray-900 font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-6 flex-wrap text-body">
                <span>Всего строк: <b className="tabular-nums">{stats.total}</b></span>
                <span className="text-success">Новых: <b className="tabular-nums">{stats.readyNew}</b></span>
                <span className="text-warning">Уже импортировано: <b className="tabular-nums">{stats.duplicates}</b></span>
                <span className="text-danger">С ошибками: <b className="tabular-nums">{stats.withErrors}</b></span>
              </div>
            </Card>
          )}

          {rawKeyField[activeSheet] && uniqueRawValues.length > 0 && (
            <Card>
              <SectionHeader title="Маппинг категорий" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uniqueRawValues.map((raw) => (
                  <div key={raw} className="space-y-1">
                    <p className="text-label text-gray-500 truncate" title={raw}>{raw}</p>
                    <CategoryCombobox
                      kind={categoryKind[activeSheet]!}
                      value={categoryMap[activeSheet]?.[raw] ?? null}
                      onChange={(cat) => setCategoryMap((prev) => ({
                        ...prev,
                        [activeSheet]: { ...prev[activeSheet], [raw]: cat },
                      }))}
                      placeholder="Выберите или создайте категорию…"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {sheetData && (
            <DataTable
              columns={columns}
              rows={sheetData.rows}
              keyField="rowNumber"
              emptyText="В этом листе нет строк для импорта"
            />
          )}

          {sheetData && sheetData.rows.length > 0 && (
            <Card>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  {!categoryReady() && (
                    <p className="text-body text-warning">Сопоставьте все категории перед импортом</p>
                  )}
                  {commitError && <p className="text-body text-danger">{commitError}</p>}
                </div>
                <Button
                  onClick={handleCommit}
                  disabled={committing || stats?.readyNew === 0 || !categoryReady()}
                  loading={committing}
                >
                  Импортировать {stats?.readyNew ?? 0} новых записей
                </Button>
              </div>

              {activeResult && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <p className="text-body text-gray-900">
                    Создано: <b className="text-success tabular-nums">{activeResult.created}</b>
                    {' · '}Пропущено (дубли): <b className="text-warning tabular-nums">{activeResult.skippedDuplicate}</b>
                    {' · '}Ошибок: <b className="text-danger tabular-nums">{activeResult.errors.length}</b>
                  </p>
                  <div>
                    <p className="text-label text-gray-500 uppercase tracking-wide mb-2">Сверка с книгой</p>
                    <ReconciliationTable
                      crm={activeResult.reconciliation}
                      book={sheetData.kpiTotals}
                    />
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// Сопоставляет ключи CRM-сверки (activeResult.reconciliation) с соответствующими
// KPI-ячейками книги по смыслу, а не по точному тексту (эмодзи/формулировки разные).
const BOOK_KEY_HINTS: Record<string, string[]> = {
  'Всего в CRM':          ['всего'],
  'Вложено всего':        ['вложено всего'],
  'Стартовые (активы)':   ['стартовые'],
  'Доинвестиции (касса)': ['доинвестиции'],
}

function findBookValue(book: Record<string, string>, crmKey: string): string | null {
  const hints = BOOK_KEY_HINTS[crmKey] ?? []
  for (const [label, value] of Object.entries(book)) {
    const norm = label.toLowerCase()
    if (hints.some((h) => norm.includes(h))) return value
  }
  return null
}

function parseEuro(s: string | null): Decimal | null {
  if (!s) return null
  const cleaned = s.replace(/€/g, '').replace(/\s/g, '').replace(/,/g, '').trim()
  if (!cleaned || cleaned === '—') return null
  try { return new Decimal(cleaned) } catch { return null }
}

function ReconciliationTable({ crm, book }: { crm: Record<string, string>; book: Record<string, string> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(crm).map(([label, crmValue]) => {
        const bookRaw = findBookValue(book, label)
        const crmDec = new Decimal(crmValue)
        const bookDec = parseEuro(bookRaw)
        const match = bookDec != null && bookDec.equals(crmDec)
        return (
          <div key={label} className="flex items-center justify-between text-body">
            <span className="text-gray-500">{label}</span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="text-gray-900">{formatMoney(crmValue)}</span>
              <span className="text-gray-500">/ книга: {bookRaw ?? '—'}</span>
              {bookDec != null && (match ? <Badge tone="success">Совпадает</Badge> : <Badge tone="danger">Не совпадает</Badge>)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
