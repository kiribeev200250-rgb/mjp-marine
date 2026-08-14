import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// DELETE /api/crm/supplier-bills/[id] — отменить заказ (ORDERED/RECEIVED, не
// оплаченный). Не трогает склад задним числом — если материал уже принят
// (RECEIVED), отмена не списывает его обратно; это осознанное упрощение —
// для возврата на склад используется обычное ручное движение.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'DELETE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const existing = await prisma.supplierBill.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status === 'PAID') {
    return NextResponse.json({ error: 'Оплаченный заказ нельзя отменить — используйте обычный учёт расходов' }, { status: 400 })
  }
  if (existing.status === 'CANCELLED') return NextResponse.json({ ok: true })

  await prisma.supplierBill.update({ where: { id }, data: { status: 'CANCELLED' } })
  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id,
    action: 'CANCEL', entity: 'SupplierBill', entityId: id, oldValue: { status: existing.status },
  })

  return NextResponse.json({ ok: true })
}
