import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// PATCH /api/crm/finance/recurring/[id] — включить/выключить (или отредактировать) шаблон
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')

  const existing = await prisma.recurringExpense.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { active } = body as { active?: boolean }

  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: { ...(active !== undefined && { active }) },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'RecurringExpense', entityId: id,
    oldValue: { active: existing.active }, newValue: { active: updated.active },
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/finance/recurring/[id] — удалить шаблон (occurrence'ы каскадом)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'DELETE')

  const existing = await prisma.recurringExpense.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.recurringExpense.delete({ where: { id } })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'DELETE',
    entity: 'RecurringExpense', entityId: id, oldValue: { category: existing.category },
  })

  return NextResponse.json({ ok: true })
}
