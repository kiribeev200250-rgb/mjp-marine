import { NextResponse } from 'next/server'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { recordPayment } from '@/lib/crm/services/invoiceCascade'
import { prisma } from '@/lib/prisma'

// POST /api/tg/invoices/[id]/pay — пометить счёт оплаченным. Тот же каскад
// (recordPayment), что и веб — доход в P&L нетто, IVA repercutido, снятие с
// дебиторки, клиент → «Оплачено». Идемпотентно: recordPayment сам не делает
// ничего на уже PAID счёте.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'INVOICES', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status === 'PAID') return NextResponse.json({ ok: true, cascade: [] })
  if (existing.status === 'CANCELLED' || existing.status === 'DRAFT') {
    return NextResponse.json({ error: 'Этот счёт нельзя пометить оплаченным' }, { status: 400 })
  }

  try {
    const cascade = await prisma.$transaction(async (tx) => {
      const lines = await recordPayment(tx, session.companyId, existing)
      await tx.auditLog.create({
        data: {
          companyId: session.companyId, userId: session.id, action: 'STATUS_CHANGE',
          entity: 'Invoice', entityId: existing.id,
          oldValue: { status: existing.status }, newValue: { status: 'PAID' },
          meta: { cascade: lines, via: 'telegram_miniapp' },
        },
      })
      return lines
    })
    return NextResponse.json({ ok: true, cascade })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
