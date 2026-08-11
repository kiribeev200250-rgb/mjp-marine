import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { parseWorkbook } from '@/lib/crm/services/importParser'

export const runtime = 'nodejs'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB

// Категория для строки книги подбирается по точному совпадению названия
// (без учёта регистра/пробелов) с уже существующей категорией нужного kind —
// иначе UI покажет «создать новую» с этим же названием как предложением.
function matchCategory(
  name: string,
  categories: { id: string; name: string }[],
): string | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  const found = categories.find((c) => c.name.trim().toLowerCase() === normalized)
  return found?.id ?? null
}

// POST /api/crm/finance/import/parse — читает загруженный .xlsx, парсит все
// распознанные листы (Расходы/Доходы/Зарплаты/Инвестиции), НИЧЕГО не пишет в
// базу. Возвращает превью: строки с ошибками валидации, флагом дубликата
// (по importRef, который уже есть в базе) и подобранной категорией.
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Файл слишком большой (макс. 15МБ)' }, { status: 400 })
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: 'Поддерживаются только .xlsx / .xls / .csv' }, { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать файл' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseWorkbook(buffer)
  } catch (e: unknown) {
    return NextResponse.json({ error: `Не удалось разобрать файл: ${e instanceof Error ? e.message : 'неизвестная ошибка'}` }, { status: 400 })
  }

  const companyId = session.user.companyId

  const [categories, existingFinanceRefs, existingCapitalRefs] = await Promise.all([
    prisma.category.findMany({ where: { companyId, archived: false }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.financeEntry.findMany({ where: { companyId, importRef: { not: null } }, select: { importRef: true } }),
    prisma.capitalEntry.findMany({ where: { companyId, importRef: { not: null } }, select: { importRef: true } }),
  ])

  const financeRefSet  = new Set(existingFinanceRefs.map((r) => r.importRef))
  const capitalRefSet  = new Set(existingCapitalRefs.map((r) => r.importRef))
  const incomeCats     = categories.filter((c) => c.kind === 'INCOME')
  const expenseCats    = categories.filter((c) => c.kind === 'EXPENSE')
  const salaryCats     = categories.filter((c) => c.kind === 'SALARY')

  const expenses = parsed.expenses.rows.map((r) => ({
    ...r,
    duplicate: financeRefSet.has(r.importRef),
    suggestedCategoryId: matchCategory(r.category, expenseCats),
  }))

  const income = parsed.income.rows.map((r) => ({
    ...r,
    duplicate: financeRefSet.has(r.importRef),
    suggestedCategoryId: matchCategory(r.workType, incomeCats),
  }))

  const salaries = parsed.salaries.rows.map((r) => ({
    ...r,
    duplicate: financeRefSet.has(r.importRef),
    suggestedCategoryId: matchCategory(r.employee, salaryCats),
  }))

  const investments = parsed.investments.rows.map((r) => ({
    ...r,
    duplicate: capitalRefSet.has(r.importRef),
  }))

  return NextResponse.json({
    expenses:    { ...parsed.expenses,    rows: expenses },
    income:      { ...parsed.income,      rows: income },
    salaries:    { ...parsed.salaries,    rows: salaries },
    investments: { ...parsed.investments, rows: investments },
    categories: {
      income:   incomeCats,
      expense:  expenseCats,
      salary:   salaryCats,
    },
  })
}
