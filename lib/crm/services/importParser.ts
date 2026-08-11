import * as XLSX from 'xlsx'
import Decimal from 'decimal.js'
import type { CapitalEntryType } from '@prisma/client'

// Парсер книги (Google Sheets export, .xlsx) — структура выяснена по реальному
// файлу владельца, не придумана заранее. Каждый лист (Расходы/Доходы/Зарплаты/
// Инвестиции) — один и тот же шаблон: заголовок листа, строка KPI-плашек,
// пустая строка, подпись «ЖУРНАЛ …», строка с именами колонок («ID», «Дата», …),
// затем сами строки данных до первой строки с пустым ID.
//
// Даты в книге бывают ДВУХ видов на один и тот же столбец: либо строка
// "DD.MM.YYYY", либо «сырое» Excel-serial-число (записанное как текст, если
// ячейка отформатирована нестандартно) — оба варианта встречаются в реальных
// данных и должны парситься. Суммы — строки вида "1,234.56 €" (запятая —
// разделитель тысяч, точка — десятичный) либо плейсхолдер «—» для пустого.

export type ImportSheetKind = 'EXPENSE' | 'INCOME' | 'SALARY' | 'INVESTMENT'

interface ImportRowBase {
  rowNumber: number // номер строки в исходном файле (1-based), для сообщений об ошибках
  importRef: string | null // "EXP-001" и т.п. — ключ идемпотентности
  errors: string[]
}

export interface ExpenseImportRow extends ImportRowBase {
  date: Date | null
  category: string
  description: string
  paymentMethod: string
  amount: Decimal | null
}

export interface IncomeImportRow extends ImportRowBase {
  date: Date | null
  clientBoat: string
  workType: string
  marina: string
  employee: string
  amount: Decimal | null
}

export interface SalaryImportRow extends ImportRowBase {
  date: Date | null
  employee: string
  position: string
  paymentMethod: string
  note: string
  amount: Decimal | null // «Итого (€)»
}

export interface InvestmentImportRow extends ImportRowBase {
  date: Date | null
  source: string
  capitalType: CapitalEntryType | null
  capitalTypeRaw: string
  purpose: string
  note: string
  amount: Decimal | null
}

export interface ParsedSheet<T> {
  sheetName: string
  found: boolean // лист с таким названием вообще есть в файле
  rows: T[]
  kpiTotals: Record<string, string> // сырые KPI-ячейки из книги (для сверки), как отображаются
}

export interface ParsedWorkbook {
  expenses: ParsedSheet<ExpenseImportRow>
  income: ParsedSheet<IncomeImportRow>
  salaries: ParsedSheet<SalaryImportRow>
  investments: ParsedSheet<InvestmentImportRow>
}

const SHEET_NAMES: Record<ImportSheetKind, string> = {
  EXPENSE:    'Расходы',
  INCOME:     'Доходы',
  SALARY:     'Зарплаты',
  INVESTMENT: 'Инвестиции',
}

const CAPITAL_TYPE_MAP: Record<string, CapitalEntryType> = {
  'Доинвестиции':          'REINVESTMENT',
  'Стартовые':             'STARTUP_ASSET',
  'Стартовые невозвратные': 'STARTUP_SUNK',
}

// Excel хранит даты как число дней с 1899-12-30 (с учётом бага с несуществующим
// 29.02.1900) — стандартная формула пересчёта в UNIX-время.
function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569)
  return new Date(utcDays * 86400 * 1000)
}

function parseBookDate(raw: unknown): Date | null {
  const s = String(raw ?? '').trim()
  if (!s || s === '—') return null

  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    return isNaN(date.getTime()) ? null : date
  }

  if (/^\d{4,6}$/.test(s)) {
    const date = excelSerialToDate(Number(s))
    return isNaN(date.getTime()) ? null : date
  }

  const generic = new Date(s)
  return isNaN(generic.getTime()) ? null : generic
}

function parseBookAmount(raw: unknown): Decimal | null {
  const s = String(raw ?? '').trim()
  if (!s || s === '—') return null
  const cleaned = s.replace(/€/g, '').replace(/\s/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null
  try {
    const d = new Decimal(cleaned)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

function cellStr(row: unknown[] | undefined, idx: number): string {
  if (!row || idx < 0) return ''
  return String(row[idx] ?? '').trim()
}

// Ищет строку-заголовок таблицы (содержит ячейку "ID") в первых N строках листа.
function findHeaderRow(rows: unknown[][]): { index: number; cells: unknown[] } | null {
  const limit = Math.min(rows.length, 20)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (row?.some((c) => String(c ?? '').trim() === 'ID')) {
      return { index: i, cells: row }
    }
  }
  return null
}

// Находит индекс колонки по одному из возможных вариантов текста заголовка
// (сверка без учёта регистра/пробелов) — не завязано на фиксированную позицию.
function findCol(headerCells: unknown[], candidates: string[]): number {
  const normalized = headerCells.map((c) => String(c ?? '').trim().toLowerCase())
  for (const cand of candidates) {
    const idx = normalized.indexOf(cand.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

// Извлекает строку KPI-плашек (третья строка листа — сразу под строкой с
// подписями плашек) как есть, ключами по подписи (обрезанным от эмодзи).
function extractKpiRow(rows: unknown[][]): Record<string, string> {
  const labelRow = rows[2] ?? []
  const valueRow = rows[3] ?? []
  const kpi: Record<string, string> = {}
  labelRow.forEach((label, idx) => {
    const text = String(label ?? '').trim()
    if (!text) return
    kpi[text] = cellStr(valueRow, idx)
  })
  return kpi
}

function sheetToRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
}

function parseExpenses(ws: XLSX.WorkSheet): ParsedSheet<ExpenseImportRow> {
  const rawRows = sheetToRows(ws)
  const kpiTotals = extractKpiRow(rawRows)
  const header = findHeaderRow(rawRows)
  if (!header) return { sheetName: SHEET_NAMES.EXPENSE, found: true, rows: [], kpiTotals }

  const cId          = findCol(header.cells, ['ID'])
  const cDate         = findCol(header.cells, ['Дата'])
  const cCategory     = findCol(header.cells, ['Категория'])
  const cDescription  = findCol(header.cells, ['Описание / Поставщик', 'Описание'])
  const cPaymentMethod = findCol(header.cells, ['Тип оплаты'])
  const cAmount       = findCol(header.cells, ['Сумма (€)', 'Сумма'])

  const rows: ExpenseImportRow[] = []
  for (let i = header.index + 1; i < rawRows.length; i++) {
    const r = rawRows[i]
    const importRef = cellStr(r, cId)
    if (!importRef) continue

    const errors: string[] = []
    const date = parseBookDate(r[cDate])
    if (!date) errors.push('Некорректная или пустая дата')
    const category = cellStr(r, cCategory)
    if (!category) errors.push('Пустая категория')
    const amount = parseBookAmount(r[cAmount])
    if (!amount || amount.lte(0)) errors.push('Некорректная или пустая сумма')

    rows.push({
      rowNumber: i + 1,
      importRef,
      errors,
      date,
      category,
      description:   cellStr(r, cDescription),
      paymentMethod: cellStr(r, cPaymentMethod),
      amount,
    })
  }

  return { sheetName: SHEET_NAMES.EXPENSE, found: true, rows, kpiTotals }
}

function parseIncome(ws: XLSX.WorkSheet): ParsedSheet<IncomeImportRow> {
  const rawRows = sheetToRows(ws)
  const kpiTotals = extractKpiRow(rawRows)
  const header = findHeaderRow(rawRows)
  if (!header) return { sheetName: SHEET_NAMES.INCOME, found: true, rows: [], kpiTotals }

  const cId         = findCol(header.cells, ['ID'])
  const cDate        = findCol(header.cells, ['Дата'])
  const cClientBoat  = findCol(header.cells, ['Клиент / Яхта', 'Клиент'])
  const cWorkType    = findCol(header.cells, ['Вид работы'])
  const cMarina      = findCol(header.cells, ['Марина'])
  const cEmployee    = findCol(header.cells, ['Сотрудник'])
  const cAmount      = findCol(header.cells, ['Сумма (€)', 'Сумма'])

  const rows: IncomeImportRow[] = []
  for (let i = header.index + 1; i < rawRows.length; i++) {
    const r = rawRows[i]
    const importRef = cellStr(r, cId)
    if (!importRef) continue

    const errors: string[] = []
    const date = parseBookDate(r[cDate])
    if (!date) errors.push('Некорректная или пустая дата')
    const amount = parseBookAmount(r[cAmount])
    if (!amount || amount.lte(0)) errors.push('Некорректная или пустая сумма')

    rows.push({
      rowNumber: i + 1,
      importRef,
      errors,
      date,
      clientBoat: cellStr(r, cClientBoat),
      workType:   cellStr(r, cWorkType),
      marina:     cellStr(r, cMarina),
      employee:   cellStr(r, cEmployee),
      amount,
    })
  }

  return { sheetName: SHEET_NAMES.INCOME, found: true, rows, kpiTotals }
}

function parseSalaries(ws: XLSX.WorkSheet): ParsedSheet<SalaryImportRow> {
  const rawRows = sheetToRows(ws)
  const kpiTotals = extractKpiRow(rawRows)
  const header = findHeaderRow(rawRows)
  if (!header) return { sheetName: SHEET_NAMES.SALARY, found: true, rows: [], kpiTotals }

  const cId            = findCol(header.cells, ['ID'])
  const cDate           = findCol(header.cells, ['Дата'])
  const cEmployee       = findCol(header.cells, ['Сотрудник'])
  const cPosition       = findCol(header.cells, ['Должность'])
  const cPaymentMethod  = findCol(header.cells, ['Тип выплаты'])
  const cNote           = findCol(header.cells, ['Примечание'])
  const cAmount         = findCol(header.cells, ['Итого (€)', 'Итого'])

  const rows: SalaryImportRow[] = []
  for (let i = header.index + 1; i < rawRows.length; i++) {
    const r = rawRows[i]
    const importRef = cellStr(r, cId)
    if (!importRef) continue

    const errors: string[] = []
    const date = parseBookDate(r[cDate])
    if (!date) errors.push('Некорректная или пустая дата')
    const amount = parseBookAmount(r[cAmount])
    if (!amount || amount.lte(0)) errors.push('Некорректная или пустая сумма')

    rows.push({
      rowNumber: i + 1,
      importRef,
      errors,
      date,
      employee:      cellStr(r, cEmployee),
      position:      cellStr(r, cPosition),
      paymentMethod: cellStr(r, cPaymentMethod),
      note:          cellStr(r, cNote),
      amount,
    })
  }

  return { sheetName: SHEET_NAMES.SALARY, found: true, rows, kpiTotals }
}

function parseInvestments(ws: XLSX.WorkSheet): ParsedSheet<InvestmentImportRow> {
  const rawRows = sheetToRows(ws)
  const kpiTotals = extractKpiRow(rawRows)
  const header = findHeaderRow(rawRows)
  if (!header) return { sheetName: SHEET_NAMES.INVESTMENT, found: true, rows: [], kpiTotals }

  const cId       = findCol(header.cells, ['ID'])
  const cDate      = findCol(header.cells, ['Дата'])
  const cSource    = findCol(header.cells, ['Источник'])
  const cType      = findCol(header.cells, ['Тип'])
  const cAmount    = findCol(header.cells, ['Сумма (€)', 'Сумма'])
  const cPurpose   = findCol(header.cells, ['Назначение'])
  const cNote      = findCol(header.cells, ['Примечание'])

  const rows: InvestmentImportRow[] = []
  for (let i = header.index + 1; i < rawRows.length; i++) {
    const r = rawRows[i]
    const importRef = cellStr(r, cId)
    if (!importRef) continue

    const errors: string[] = []
    const date = parseBookDate(r[cDate])
    if (!date) errors.push('Некорректная или пустая дата')
    const amount = parseBookAmount(r[cAmount])
    if (!amount || amount.lte(0)) errors.push('Некорректная или пустая сумма')
    const capitalTypeRaw = cellStr(r, cType)
    const capitalType = CAPITAL_TYPE_MAP[capitalTypeRaw] ?? null
    if (!capitalType) errors.push(`Неизвестный тип вложения: "${capitalTypeRaw}"`)

    rows.push({
      rowNumber: i + 1,
      importRef,
      errors,
      date,
      source: cellStr(r, cSource),
      capitalType,
      capitalTypeRaw,
      purpose: cellStr(r, cPurpose),
      note:    cellStr(r, cNote),
      amount,
    })
  }

  return { sheetName: SHEET_NAMES.INVESTMENT, found: true, rows, kpiTotals }
}

export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const sheet = (name: string) => wb.Sheets[name]
  const empty = <T>(name: string): ParsedSheet<T> => ({ sheetName: name, found: false, rows: [], kpiTotals: {} })

  return {
    expenses:    sheet(SHEET_NAMES.EXPENSE)    ? parseExpenses(sheet(SHEET_NAMES.EXPENSE))       : empty(SHEET_NAMES.EXPENSE),
    income:      sheet(SHEET_NAMES.INCOME)     ? parseIncome(sheet(SHEET_NAMES.INCOME))          : empty(SHEET_NAMES.INCOME),
    salaries:    sheet(SHEET_NAMES.SALARY)     ? parseSalaries(sheet(SHEET_NAMES.SALARY))        : empty(SHEET_NAMES.SALARY),
    investments: sheet(SHEET_NAMES.INVESTMENT) ? parseInvestments(sheet(SHEET_NAMES.INVESTMENT)) : empty(SHEET_NAMES.INVESTMENT),
  }
}
