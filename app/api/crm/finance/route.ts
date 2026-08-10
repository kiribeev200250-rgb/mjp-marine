import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { parseAmountExpr } from '@/lib/crm/utils'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import type { FinanceEntryType } from '@prisma/client'

const VALID_TYPES: FinanceEntryType[] = ['INCOME', 'EXPENSE', 'SALARY']

export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  const { searchParams } = req.nextUrl
  const type     = searchParams.get('type') as FinanceEntryType | null
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const entries = await prisma.financeEntry.findMany({
    where: {
      companyId: session.user.companyId,
      ...(type && { type }),
      ...(from && { date: { gte: new Date(from) } }),
      ...(to   && { date: { lte: new Date(to)   } }),
    },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: 'desc' },
    take:    limit,
  })

  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')

  const body = await req.json()
  const { type, category, categoryId, amountExpr, date, paymentMethod, description, clientId } = body

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Некорректный тип' }, { status: 400 })
  }

  let categoryName = category?.trim() ?? ''
  if (categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: categoryId, companyId: session.user.companyId, kind: type } })
    if (!cat) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
    categoryName = cat.name
  }
  if (!categoryName) {
    return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })
  }

  let amount
  try {
    amount = parseAmountExpr(String(amountExpr ?? '0'))
    if (amount.lte(0)) throw new Error('Сумма должна быть > 0')
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
  }

  const entryDate = date ? new Date(date) : new Date()
  const year      = entryDate.getFullYear()
  const autoId    = await nextFinanceAutoId(session.user.companyId, type, year)

  const entry = await prisma.$transaction(async (tx) => {
    const e = await tx.financeEntry.create({
      data: {
        companyId:     session.user.companyId,
        autoId,
        type,
        date:          entryDate,
        category:      categoryName,
        ...(categoryId && { categoryId }),
        amountExpr:    String(amountExpr ?? amount.toString()),
        amount,
        paymentMethod: (paymentMethod ?? '').trim(),
        description:   (description   ?? '').trim(),
        ...(clientId && { clientId }),
      },
    })
    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'CREATE',
        entity:    'FinanceEntry',
        entityId:  e.id,
        newValue:  { type, amount: amount.toString(), category: categoryName },
      },
    })
    return e
  })

  return NextResponse.json(entry, { status: 201 })
}