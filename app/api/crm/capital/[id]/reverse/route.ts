import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/crm/permissions'
import { nextCapitalAutoId } from '@/lib/crm/numbering'

type Ctx = { params: Promise<{ id: string }> }

// Ручное сторно вложения — единственный способ исправить неверный type/amount
// (см. PATCH в [id]/route.ts). Создаёт новую запись того же type с отрицательной
// amount, датированную сегодняшним днём, ссылающуюся на исходную через reversalOfId.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const existing = await prisma.capitalEntry.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  const now  = new Date()
  const year = now.getFullYear()

  const reversal = await prisma.$transaction(async (tx) => {
    const autoId = await nextCapitalAutoId(tx, session.user.companyId, year)
    const amount = existing.amount.negated()

    const e = await tx.capitalEntry.create({
      data: {
        companyId:    session.user.companyId,
        autoId,
        type:         existing.type,
        date:         now,
        source:       existing.source,
        amount,
        note:         `Сторно ${existing.autoId}${note ? ': ' + note : ''}`,
        reversalOfId: existing.id,
      },
    })

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'REVERSE',
        entity:    'CapitalEntry',
        entityId:  e.id,
        oldValue:  { reversalOf: existing.id, reversalOfAutoId: existing.autoId, amount: existing.amount.toString(), type: existing.type },
        newValue:  { amount: amount.toString() },
      },
    })

    return e
  })

  return NextResponse.json(reversal, { status: 201 })
}
