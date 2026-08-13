import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import type { CapitalEntryType, CategoryKind, FinanceEntryType, PrismaClient } from '@prisma/client'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

type ImportSheet = 'EXPENSE' | 'INCOME' | 'SALARY' | 'INVESTMENT'

interface CommitRow {
  importRef:    string
  date:         string
  amount:       string
  categoryId?:  string | null
  categoryName?: string | null
  description?: string
  paymentMethod?: string
  capitalType?: CapitalEntryType
  note?:        string
}

const FINANCE_TYPE_BY_SHEET: Record<'EXPENSE' | 'INCOME' | 'SALARY', FinanceEntryType> = {
  EXPENSE: 'EXPENSE',
  INCOME:  'INCOME',
  SALARY:  'SALARY',
}
const CATEGORY_KIND_BY_SHEET: Record<'EXPENSE' | 'INCOME' | 'SALARY', CategoryKind> = {
  EXPENSE: 'EXPENSE',
  INCOME:  'INCOME',
  SALARY:  'SALARY',
}
const FINANCE_PREFIX: Record<FinanceEntryType, string> = { INCOME: 'INC', EXPENSE: 'EXP', SALARY: 'SAL' }

// Находит/создаёт категорию внутри уже открытой транзакции — тот же паттерн
// идемпотентного upsert, что и в POST /api/crm/categories, но tx-aware, чтобы
// категории, созданные «на лету» первой же строкой импорта, сразу были видны
// следующим строкам того же батча.
async function resolveCategory(
  tx: Tx,
  companyId: string,
  kind: CategoryKind,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (categoryId) {
    const existing = await tx.category.findFirst({ where: { id: categoryId, companyId, kind } })
    if (existing) return { id: existing.id, name: existing.name }
  }
  const trimmed = categoryName?.trim()
  if (!trimmed) return null

  const existing = await tx.category.findUnique({ where: { companyId_kind_name: { companyId, kind, name: trimmed } } })
  if (existing) {
    if (existing.archived) await tx.category.update({ where: { id: existing.id }, data: { archived: false } })
    return { id: existing.id, name: existing.name }
  }

  const maxOrder = await tx.category.aggregate({ where: { companyId, kind }, _max: { sortOrder: true } })
  const created = await tx.category.create({
    data: { companyId, kind, name: trimmed, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })
  return { id: created.id, name: created.name }
}

// POST /api/crm/finance/import/commit — транзакционная запись одной пачки строк
// (один тип листа за раз). Идемпотентно: importRef, уже существующий в базе,
// пропускается (не создаётся повторно) — это и есть защита от дублей при
// повторном импорте того же файла. Компаунд-уникальность (companyId,importRef)
// в схеме — финальный бэкстоп на уровне БД на случай гонки (двойной сабмит).
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const sheet = body?.sheet as ImportSheet | undefined
  const rows  = body?.rows as CommitRow[] | undefined

  if (!sheet || !['EXPENSE', 'INCOME', 'SALARY', 'INVESTMENT'].includes(sheet)) {
    return NextResponse.json({ error: 'Некорректный тип листа' }, { status: 400 })
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Нет строк для импорта' }, { status: 400 })
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: 'Слишком много строк за один импорт (макс. 2000)' }, { status: 400 })
  }

  const companyId = session.user.companyId
  const created: string[] = []
  const skippedDuplicate: string[] = []
  const errors: { importRef: string; error: string }[] = []

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Дедуп внутри самого батча (на случай, если клиент прислал одну строку дважды).
      const seenInBatch = new Set<string>()
      // Кэш категорий внутри батча — импорт книги бьёт по единицам уникальных
      // категорий на сотни строк, без кэша это сотни лишних round-trip'ов к
      // БД и упирается в таймаут интерактивной транзакции Prisma.
      const categoryCache = new Map<string, { id: string; name: string } | null>()
      async function resolveCategoryCached(kind: CategoryKind, categoryId?: string | null, categoryName?: string | null) {
        const cacheKey = `${categoryId ?? ''}|${categoryName ?? ''}`
        if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey)!
        const resolved = await resolveCategory(tx, companyId, kind, categoryId, categoryName)
        categoryCache.set(cacheKey, resolved)
        return resolved
      }

      if (sheet === 'INVESTMENT') {
        const existingRefs = new Set(
          (await tx.capitalEntry.findMany({
            where: { companyId, importRef: { in: rows.map((r) => r.importRef) } },
            select: { importRef: true },
          })).map((r) => r.importRef),
        )

        const yearCounters = new Map<number, number>()
        for (const row of rows) {
          if (seenInBatch.has(row.importRef) || existingRefs.has(row.importRef)) {
            skippedDuplicate.push(row.importRef)
            continue
          }
          seenInBatch.add(row.importRef)

          const date = new Date(row.date)
          const amount = new Decimal(row.amount || '0')
          if (isNaN(date.getTime()) || amount.lte(0) || !row.capitalType) {
            errors.push({ importRef: row.importRef, error: 'Некорректные данные строки' })
            continue
          }

          const year = date.getFullYear()
          if (!yearCounters.has(year)) {
            yearCounters.set(year, await tx.capitalEntry.count({
              where: { companyId, date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
            }))
          }
          const seq = yearCounters.get(year)! + 1
          yearCounters.set(year, seq)
          const autoId = `INV-${year}-${String(seq).padStart(3, '0')}`

          const entry = await tx.capitalEntry.create({
            data: {
              companyId,
              autoId,
              type:   row.capitalType,
              date,
              source: (row.description ?? '').trim(),
              amount,
              note:   (row.note ?? '').trim(),
              importRef: row.importRef,
            },
          })
          created.push(entry.id)
        }
      } else {
        const financeType = FINANCE_TYPE_BY_SHEET[sheet]
        const categoryKind = CATEGORY_KIND_BY_SHEET[sheet]

        const existingRefs = new Set(
          (await tx.financeEntry.findMany({
            where: { companyId, importRef: { in: rows.map((r) => r.importRef) } },
            select: { importRef: true },
          })).map((r) => r.importRef),
        )

        const yearCounters = new Map<number, number>()
        for (const row of rows) {
          if (seenInBatch.has(row.importRef) || existingRefs.has(row.importRef)) {
            skippedDuplicate.push(row.importRef)
            continue
          }
          seenInBatch.add(row.importRef)

          const date = new Date(row.date)
          const amount = new Decimal(row.amount || '0')
          if (isNaN(date.getTime()) || amount.lte(0)) {
            errors.push({ importRef: row.importRef, error: 'Некорректные данные строки' })
            continue
          }

          const category = await resolveCategoryCached(categoryKind, row.categoryId, row.categoryName)
          if (!category) {
            errors.push({ importRef: row.importRef, error: 'Не удалось определить категорию' })
            continue
          }

          const year = date.getFullYear()
          if (!yearCounters.has(year)) {
            yearCounters.set(year, await tx.financeEntry.count({
              where: { companyId, type: financeType, date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
            }))
          }
          const seq = yearCounters.get(year)! + 1
          yearCounters.set(year, seq)
          const autoId = `${FINANCE_PREFIX[financeType]}-${year}-${String(seq).padStart(3, '0')}`

          const entry = await tx.financeEntry.create({
            data: {
              companyId,
              autoId,
              type:       financeType,
              date,
              category:   category.name,
              categoryId: category.id,
              amountExpr: amount.toString(),
              amount,
              paymentMethod: (row.paymentMethod ?? '').trim(),
              description:   (row.description ?? '').trim(),
              importRef:  row.importRef,
            },
          })
          created.push(entry.id)
        }
      }

      return { created: created.length, skippedDuplicate: skippedDuplicate.length, errors }
    }, { timeout: 60000, maxWait: 10000 })

    await writeAudit({
      companyId,
      userId: session.user.id,
      action: 'IMPORT',
      entity: sheet === 'INVESTMENT' ? 'CapitalEntry' : 'FinanceEntry',
      entityId: 'bulk-import',
      newValue: { sheet, ...result },
    })

    // Сверка «как сейчас в CRM» — считается ПОСЛЕ коммита, по реально
    // сохранённым записям (не по тому, что прислал клиент), чтобы UI мог
    // сравнить с собственными итоговыми ячейками книги.
    let reconciliation: Record<string, string>
    if (sheet === 'INVESTMENT') {
      const [total, startup, reinvestment] = await Promise.all([
        prisma.capitalEntry.aggregate({ where: { companyId }, _sum: { amount: true } }),
        prisma.capitalEntry.aggregate({ where: { companyId, type: 'STARTUP_ASSET' }, _sum: { amount: true } }),
        prisma.capitalEntry.aggregate({ where: { companyId, type: 'REINVESTMENT' }, _sum: { amount: true } }),
      ])
      reconciliation = {
        'Вложено всего':        (total._sum.amount ?? new Decimal(0)).toFixed(2),
        'Стартовые (активы)':   (startup._sum.amount ?? new Decimal(0)).toFixed(2),
        'Доинвестиции (касса)': (reinvestment._sum.amount ?? new Decimal(0)).toFixed(2),
      }
    } else {
      const financeType = FINANCE_TYPE_BY_SHEET[sheet]
      const total = await prisma.financeEntry.aggregate({ where: { companyId, type: financeType }, _sum: { amount: true } })
      reconciliation = { 'Всего в CRM': (total._sum.amount ?? new Decimal(0)).toFixed(2) }
    }

    return NextResponse.json({ ...result, reconciliation })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка импорта' }, { status: 400 })
  }
}
