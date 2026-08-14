import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { receiveSupplierBill } from '@/lib/crm/services/supplierBills'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  try {
    const lines = await prisma.$transaction((tx) => receiveSupplierBill(tx, session.user.companyId, id))
    await writeAudit({
      companyId: session.user.companyId, userId: session.user.id,
      action: 'RECEIVE', entity: 'SupplierBill', entityId: id, meta: { cascade: lines },
    })
    return NextResponse.json({ ok: true, lines })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
