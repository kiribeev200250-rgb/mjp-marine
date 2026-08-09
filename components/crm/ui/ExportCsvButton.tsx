'use client'

import { Button, type ButtonProps } from './Button'
import { exportToCsv, type CsvRow } from '@/lib/crm/csv'

interface Props extends Omit<ButtonProps, 'onClick'> {
  filename: string
  headers:  string[]
  rows:     CsvRow[]
}

// headers/rows должны быть уже готовыми плоскими примитивами (посчитанными на сервере) —
// функции нельзя передавать из Server Component в Client Component.
export function ExportCsvButton({ filename, headers, rows, children, ...buttonProps }: Props) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => exportToCsv(filename, headers, rows)}
      disabled={rows.length === 0}
      {...buttonProps}
    >
      {children ?? '⬇ Экспорт CSV'}
    </Button>
  )
}
