'use client'

// Экспорт таблицы в CSV — совместимо с Excel/Google Sheets (BOM + запятая-разделитель).
// headers/rows — только плоские примитивы (server → client boundary не пропускает функции).
export type CsvCell = string | number
export type CsvRow  = CsvCell[]

function escapeCsvCell(value: CsvCell): string {
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportToCsv(filename: string, headers: string[], rows: CsvRow[]): void {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const lines       = rows.map((row) => row.map(escapeCsvCell).join(','))
  const csv         = [headerLine, ...lines].join('\r\n')

  // BOM — чтобы Excel корректно определял UTF-8 (иначе кириллица превращается в кракозябры)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
