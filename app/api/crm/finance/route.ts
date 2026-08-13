import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/crm/permissions'
import { parseAmountExpr } from '@/lib/crm/utils'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import { recordVat } from '@/lib/crm/services/vat'
import { findActivePeriodLock } from '@/lib/crm/periodLock'
import type { FinanceEntryType } from '@prisma/client'

const VALID_TYPES: FinanceEntryType[] = ['INCOME', 'EXPENSE', 'SALARY']

export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
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
  if (!hasPermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const body = await req.json()
  const { type, category, categoryId, amountExpr, date, paymentMethod, description, clientId, hasVat, vatRate } = body

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

  // Только расход может нести IVA. Если помечено «с IVA», введённая сумма
  // считается брутто (как в чеке) — сохраняем нетто в amount (это то, что
  // видит P&L), а IVA уходит отдельно в книгу soportado.
  const withVat = type === 'EXPENSE' && !!hasVat

  let grossOrNet
  try {
    grossOrNet = parseAmountExpr(String(amountExpr ?? '0'))
    if (grossOrNet.lte(0)) throw new Error('Сумма должна быть > 0')
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
  }

  let amount = grossOrNet
  let rate   = new Decimal(0)
  let vat    = new Decimal(0)
  if (withVat) {
    rate = new Decimal(vatRate ?? 21)
    if (rate.lt(0) || rate.gt(100)) {
      return NextResponse.json({ error: 'Ставка IVA должна быть от 0 до 100%' }, { status: 400 })
    }
    amount = grossOrNet.div(rate.div(100).plus(1)).toDecimalPlaces(2)
    vat    = grossOrNet.minus(amount)
  }

  const entryDate = date ? new Date(date) : new Date()
  if (isNaN(entryDate.getTime())) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
  const year      = entryDate.getFullYear()

  const lock = await findActivePeriodLock(session.user.companyId, entryDate)
  if (lock) {
    return NextResponse.json({ error: `Период «${lock.label}» закрыт — новую операцию задним числом создать нельзя` }, { status: 403 })
  }

  const entry = await prisma.$transaction(async (tx) => {
    const autoId = await nextFinanceAutoId(tx, session.user.companyId, type, year)
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
        hasVat:        withVat,
        vatRate:       rate,
        vatAmount:     vat,
        paymentMethod: (paymentMethod ?? '').trim(),
        description:   (description   ?? '').trim(),
        ...(clientId && { clientId }),
      },
    })

    if (withVat) {
      await recordVat(tx, session.user.companyId, {
        direction:      'SOPORTADO',
        date:           entryDate,
        baseAmount:     amount,
        rate,
        amount:         vat,
        financeEntryId: e.id,
        note:           categoryName,
      })
    }

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'CREATE',
        entity:    'FinanceEntry',
        entityId:  e.id,
        newValue:  { type, amount: amount.toString(), category: categoryName, hasVat: withVat, vatAmount: vat.toString() },
      },
    })
    return e
  })

  return NextResponse.json(entry, { status: 201 })
}