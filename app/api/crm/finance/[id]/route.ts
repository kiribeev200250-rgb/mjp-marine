import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { parseAmountExpr } from '@/lib/crm/utils'
import { findActivePeriodLock } from '@/lib/crm/periodLock'
import Decimal from 'decimal.js'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')

  const existing = await prisma.financeEntry.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lock = await findActivePeriodLock(session.user.companyId, existing.date)
  if (lock) {
    return NextResponse.json(
      { error: `Период «${lock.label}» закрыт — правка запрещена. Исправление — сторно новой записью в открытом периоде` },
      { status: 403 },
    )
  }

  const body = await req.json()
  const { category, amountExpr, date, paymentMethod, description } = body

  // Проведённая операция, порождённая каскадом счёта (оплата/возврат), не
  // редактируется по сумме напрямую — только через возврат/отмену оплаты
  // счёта, чтобы IVA/AR/аудит оставались согласованы. Метаданные (категория,
  // дата, способ оплаты, описание) править можно.
  if (existing.invoiceId && amountExpr != null) {
    return NextResponse.json(
      { error: 'Сумма операции по счёту не редактируется напрямую — используйте возврат по счёту' },
      { status: 400 },
    )
  }

  // Если у записи уже есть IVA, введённая сумма по-прежнему брутто — пересчитываем
  // нетто/vat по её текущей ставке (ставку саму по себе PATCH не меняет).
  let amount    = existing.amount
  let vatAmount = existing.vatAmount
  if (amountExpr != null) {
    try {
      const parsed = parseAmountExpr(String(amountExpr))
      if (parsed.lte(0)) throw new Error('Сумма должна быть > 0')
      if (existing.hasVat) {
        const rate = new Decimal(existing.vatRate.toString())
        amount    = parsed.div(rate.div(100).plus(1)).toDecimalPlaces(2)
        vatAmount = parsed.minus(amount)
      } else {
        amount = parsed
      }
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.financeEntry.update({
      where: { id },
      data: {
        ...(category      != null && { category:      category.trim()      }),
        ...(amountExpr    != null && { amountExpr:    String(amountExpr), amount, vatAmount }),
        ...(date          != null && { date:           new Date(date)       }),
        ...(paymentMethod != null && { paymentMethod: paymentMethod.trim() }),
        ...(description   != null && { description:   description.trim()   }),
      },
    })

    if (amountExpr != null && existing.hasVat) {
      await tx.vatEntry.updateMany({
        where: { financeEntryId: id },
        data:  { baseAmount: amount, amount: vatAmount },
      })
    }

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'UPDATE',
        entity:    'FinanceEntry',
        entityId:  id,
        oldValue:  { amount: existing.amount, category: existing.category },
        newValue:  body,
      },
    })

    return u
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'DELETE')

  const existing = await prisma.financeEntry.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.invoiceId) {
    return NextResponse.json(
      { error: 'Операция по счёту не удаляется напрямую — используйте возврат/отмену оплаты счёта' },
      { status: 400 },
    )
  }

  const lock = await findActivePeriodLock(session.user.companyId, existing.date)
  if (lock) {
    return NextResponse.json(
      { error: `Период «${lock.label}» закрыт — удаление запрещено. Исправление — сторно новой записью в открытом периоде` },
      { status: 403 },
    )
  }

  await prisma.$transaction([
    prisma.financeEntry.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'DELETE',
        entity:    'FinanceEntry',
        entityId:  id,
        oldValue:  { amount: existing.amount, type: existing.type, category: existing.category },
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}