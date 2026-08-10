import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// PATCH — переименовать и/или архивировать/разархивировать. Переименование не
// ломает историю: FinanceEntry ссылается по id, старые записи сразу показывают
// новое имя через связь categoryRef.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')

  const existing = await prisma.category.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { name, archived } = body as { name?: string; archived?: boolean }

  const data: { name?: string; archived?: boolean } = {}
  if (name !== undefined) {
    const trimmed = name.trim()
    if (!trimmed) return NextResponse.json({ error: 'Название не может быть пустым' }, { status: 400 })
    data.name = trimmed
  }
  if (archived !== undefined) data.archived = archived

  try {
    const updated = await prisma.category.update({ where: { id }, data })
    await writeAudit({
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'UPDATE',
      entity:    'Category',
      entityId:  id,
      oldValue:  { name: existing.name, archived: existing.archived },
      newValue:  { name: updated.name, archived: updated.archived },
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}

// DELETE — только если по категории нет ни одной операции.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'DELETE')

  const existing = await prisma.category.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const used = await prisma.financeEntry.count({ where: { categoryId: id } })
  if (used > 0) {
    return NextResponse.json({ error: `По категории уже есть ${used} операц${used === 1 ? 'ия' : 'ий'} — удалить нельзя, можно скрыть` }, { status: 400 })
  }

  await prisma.category.delete({ where: { id } })
  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'DELETE',
    entity:    'Category',
    entityId:  id,
  })

  return NextResponse.json({ ok: true })
}
