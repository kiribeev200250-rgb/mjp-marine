import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// PATCH /api/crm/suppliers/[id] — редактировать реквизиты / активность
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const existing = await prisma.supplier.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { name, contactName, phone, email, notes, active } = body as {
    name?: string; contactName?: string; phone?: string; email?: string; notes?: string; active?: boolean
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      ...(name        !== undefined && { name: name.trim() }),
      ...(contactName !== undefined && { contactName: contactName.trim() }),
      ...(phone       !== undefined && { phone: phone.trim() }),
      ...(email       !== undefined && { email: email.trim() }),
      ...(notes       !== undefined && { notes: notes.trim() }),
      ...(active      !== undefined && { active }),
    },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id,
    action: 'UPDATE', entity: 'Supplier', entityId: id, oldValue: { name: existing.name }, newValue: { name: updated.name },
  })

  return NextResponse.json(updated)
}
