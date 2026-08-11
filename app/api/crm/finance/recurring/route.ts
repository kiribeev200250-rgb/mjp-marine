import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { RecurrenceFrequency } from '@prisma/client'

const VALID_FREQ: RecurrenceFrequency[] = ['MONTHLY', 'WEEKLY', 'YEARLY']

// GET /api/crm/finance/recurring — список шаблонов повторяющихся расходов
export async function GET() {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  const templates = await prisma.recurringExpense.findMany({
    where: { companyId: session.user.companyId },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(templates)
}

// POST /api/crm/finance/recurring — новый шаблон
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')

  const body = await req.json()
  const {
    category, categoryId, amount: amountRaw, paymentMethod, description,
    frequency, dayOfMonth, monthOfYear,
  } = body as {
    category?: string; categoryId?: string; amount?: string | number; paymentMethod?: string; description?: string
    frequency?: RecurrenceFrequency; dayOfMonth?: number; monthOfYear?: number
  }

  if (!category?.trim()) return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })
  if (!frequency || !VALID_FREQ.includes(frequency)) return NextResponse.json({ error: 'Некорректная периодичность' }, { status: 400 })

  let amount: Decimal
  try {
    amount = new Decimal(String(amountRaw ?? '0'))
    if (amount.lte(0)) throw new Error('Сумма должна быть > 0')
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
  }

  const day = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 28)
  if (frequency === 'YEARLY' && (!monthOfYear || monthOfYear < 1 || monthOfYear > 12)) {
    return NextResponse.json({ error: 'Укажите месяц для годовой периодичности' }, { status: 400 })
  }

  const template = await prisma.recurringExpense.create({
    data: {
      companyId: session.user.companyId,
      category: category.trim(),
      categoryId: categoryId || null,
      amount,
      paymentMethod: (paymentMethod ?? '').trim(),
      description: (description ?? '').trim(),
      frequency,
      dayOfMonth: day,
      monthOfYear: frequency === 'YEARLY' ? monthOfYear : null,
    },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'CREATE',
    entity: 'RecurringExpense', entityId: template.id,
    newValue: { category, amount: amount.toString(), frequency },
  })

  return NextResponse.json(template, { status: 201 })
}
