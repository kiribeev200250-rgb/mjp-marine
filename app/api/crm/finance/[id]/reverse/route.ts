import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import { recordVat } from '@/lib/crm/services/vat'

type Ctx = { params: Promise<{ id: string }> }

// Ручное сторно операции (в т.ч. из закрытого периода — исправление всегда
// в открытом, см. lib/crm/periodLock.ts). Создаёт новую запись того же type
// с отрицательной amount, датированную сегодняшним днём, а не редактирует
// исходную — история остаётся видна целиком (тот же паттерн, что уже
// использует invoiceCascade.ts для возвратов по счетам).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')

  const existing = await prisma.financeEntry.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  if (existing.invoiceId) {
    return NextResponse.json(
      { error: 'Операция по счёту сторнируется через возврат/отмену оплаты счёта, не отсюда' },
      { status: 400 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  const now  = new Date()
  const year = now.getFullYear()

  const reversal = await prisma.$transaction(async (tx) => {
    const autoId = await nextFinanceAutoId(tx, session.user.companyId, existing.type, year)
    const amount    = existing.amount.negated()
    const vatAmount = existing.vatAmount.negated()

    const e = await tx.financeEntry.create({
      data: {
        companyId:     session.user.companyId,
        autoId,
        type:          existing.type,
        date:          now,
        category:      existing.category,
        categoryId:    existing.categoryId,
        amountExpr:    amount.toString(),
        amount,
        hasVat:        existing.hasVat,
        vatRate:       existing.vatRate,
        vatAmount,
        paymentMethod: existing.paymentMethod,
        description:   `Сторно ${existing.autoId}${note ? ': ' + note : ''}`,
        clientId:      existing.clientId,
        reversalOfId:  existing.id,
      },
    })

    if (existing.hasVat && !vatAmount.isZero()) {
      await recordVat(tx, session.user.companyId, {
        direction:      'SOPORTADO',
        date:           now,
        baseAmount:     amount,
        rate:           existing.vatRate,
        amount:         vatAmount,
        financeEntryId: e.id,
        note:           `Сторно ${existing.autoId}`,
      })
    }

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'REVERSE',
        entity:    'FinanceEntry',
        entityId:  e.id,
        oldValue:  { reversalOf: existing.id, reversalOfAutoId: existing.autoId, amount: existing.amount.toString() },
        newValue:  { amount: amount.toString() },
      },
    })

    return e
  })

  return NextResponse.json(reversal, { status: 201 })
}
