import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { paySupplierBill } from '@/lib/crm/services/supplierBills'
import { findActivePeriodLock } from '@/lib/crm/periodLock'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const lock = await findActivePeriodLock(session.user.companyId, new Date())
  if (lock) {
    return NextResponse.json({ error: `Период «${lock.label}» закрыт — новую операцию создать нельзя` }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const paymentMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod : undefined

  try {
    const lines = await prisma.$transaction((tx) => paySupplierBill(tx, session.user.companyId, id, paymentMethod))
    await writeAudit({
      companyId: session.user.companyId, userId: session.user.id,
      action: 'PAY', entity: 'SupplierBill', entityId: id, meta: { cascade: lines },
    })
    return NextResponse.json({ ok: true, lines })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
