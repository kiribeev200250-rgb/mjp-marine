import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { parseAmountExpr } from '@/lib/crm/utils'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import { computeCashSummary } from '@/lib/crm/services/cash'
import { prisma } from '@/lib/prisma'
import type { FinanceEntryType } from '@prisma/client'

const VALID_TYPES: FinanceEntryType[] = ['INCOME', 'EXPENSE', 'SALARY']

// GET /api/tg/finance — касса, P&L за месяц, последние операции
export async function GET(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'FINANCE', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [summary, monthFinances, recent] = await Promise.all([
    computeCashSummary(session.companyId),
    prisma.financeEntry.findMany({ where: { companyId: session.companyId, date: { gte: monthStart } }, select: { type: true, amount: true } }),
    prisma.financeEntry.findMany({
      where: { companyId: session.companyId }, orderBy: { date: 'desc' }, take: 20,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
  ])

  let plMonth = new Decimal(0)
  for (const f of monthFinances) plMonth = f.type === 'INCOME' ? plMonth.plus(f.amount.toString()) : plMonth.minus(f.amount.toString())

  return NextResponse.json({
    cash: summary.cash.toString(),
    plMonth: plMonth.toString(),
    recent: recent.map((e) => ({
      id: e.id, autoId: e.autoId, type: e.type, date: e.date.toISOString(),
      category: e.category, amount: e.amount.toString(),
      client: e.client ? `${e.client.firstName} ${e.client.lastName}` : null,
    })),
  })
}

// POST /api/tg/finance — записать операцию
export async function POST(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'FINANCE', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { type, category, amountExpr, paymentMethod, description } = await req.json() as {
    type: FinanceEntryType; category: string; amountExpr: string; paymentMethod?: string; description?: string
  }
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Некорректный тип' }, { status: 400 })
  if (!category?.trim()) return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })

  let amount: Decimal
  try {
    amount = parseAmountExpr(String(amountExpr ?? '0'))
    if (amount.lte(0)) throw new Error('Сумма должна быть > 0')
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
  }

  const year = new Date().getFullYear()

  const entry = await prisma.$transaction(async (tx) => {
    const autoId = await nextFinanceAutoId(tx, session.companyId, type, year)
    return tx.financeEntry.create({
      data: {
        companyId: session.companyId, autoId, type, date: new Date(),
        category: category.trim(), amountExpr: String(amountExpr ?? amount.toString()), amount,
        paymentMethod: (paymentMethod ?? '').trim(), description: (description ?? 'Через Telegram Mini App').trim(),
      },
    })
  })

  await writeAudit({
    companyId: session.companyId, userId: session.id, action: 'CREATE',
    entity: 'FinanceEntry', entityId: entry.id,
    newValue: { type, amount: amount.toString(), category }, meta: { via: 'telegram_miniapp' },
  })

  return NextResponse.json({ ok: true, autoId: entry.autoId }, { status: 201 })
}
