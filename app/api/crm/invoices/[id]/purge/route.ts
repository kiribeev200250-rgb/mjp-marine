import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// DELETE /api/crm/invoices/[id]/purge — безвозвратное удаление счёта.
// Отдельный роут от DELETE /api/crm/invoices/[id] (тот только отменяет —
// ставит CANCELLED, не трогая сквозную нумерацию, что важно для налоговой
// отчётности). Здесь — реальное удаление, поэтому доступ строго ADMIN,
// и заблокировано для оплаченных счетов / счетов с привязанными платежами.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Удалять счета безвозвратно может только администратор' }, { status: 403 })
  }

  const existing = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { finances: { select: { id: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  if (existing.status === 'PAID') {
    return NextResponse.json({ error: 'Нельзя удалить оплаченный счёт' }, { status: 400 })
  }
  if (existing.finances.length > 0) {
    return NextResponse.json({ error: 'К счёту привязаны платежи в финансах — сначала удалите их' }, { status: 400 })
  }

  await prisma.invoice.delete({ where: { id } })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'DELETE',
    entity:    'Invoice',
    entityId:  id,
    oldValue:  { number: existing.number, status: existing.status, total: existing.total.toString() },
  })

  return NextResponse.json({ ok: true })
}
