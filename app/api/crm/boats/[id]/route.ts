import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

async function findBoat(companyId: string, id: string) {
  return prisma.yacht.findFirst({ where: { id, client: { companyId } } })
}

// PATCH — редактировать поля лодки, включая переназначение владельца
// («продал лодку» — clientId меняется, вся история по boatId остаётся при лодке).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'EDIT')

  const existing = await findBoat(session.user.companyId, id)
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { clientId, name, model, length, engine, marina, regNumber, notes, archived } = body as {
    clientId?: string
    name?: string
    model?: string
    length?: string | number | null
    engine?: string
    marina?: string
    regNumber?: string
    notes?: string
    archived?: boolean
  }

  if (clientId !== undefined && clientId !== existing.clientId) {
    const newClient = await prisma.client.findFirst({ where: { id: clientId, companyId: session.user.companyId } })
    if (!newClient) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
  }

  const updated = await prisma.yacht.update({
    where: { id },
    data: {
      ...(clientId  !== undefined && { clientId }),
      ...(name      !== undefined && { name: name.trim() }),
      ...(model     !== undefined && { model: model.trim() }),
      ...(length    !== undefined && { length: length === '' || length === null ? null : length.toString() }),
      ...(engine    !== undefined && { engine: engine.trim() }),
      ...(marina    !== undefined && { marina: marina.trim() }),
      ...(regNumber !== undefined && { regNumber: regNumber.trim() }),
      ...(notes     !== undefined && { notes: notes.trim() }),
      ...(archived  !== undefined && { archived }),
    },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'UPDATE',
    entity:    'Yacht',
    entityId:  id,
    oldValue:  { clientId: existing.clientId, name: existing.name },
    newValue:  { clientId: updated.clientId, name: updated.name },
    ...(clientId !== undefined && clientId !== existing.clientId && { meta: { reassigned: true } }),
  })

  return NextResponse.json(updated)
}

// DELETE — удалить лодку безвозвратно, только если по ней нет истории
// (сметы/счета/задачи/заметки); иначе — архивировать (перестаёт предлагаться,
// но история сохраняется).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'DELETE')

  const existing = await findBoat(session.user.companyId, id)
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const [quotes, invoices, tasks, notes] = await Promise.all([
    prisma.quote.count({ where: { boatId: id } }),
    prisma.invoice.count({ where: { boatId: id } }),
    prisma.task.count({ where: { boatId: id } }),
    prisma.note.count({ where: { boatId: id } }),
  ])

  if (quotes + invoices + tasks + notes > 0) {
    const archived = await prisma.yacht.update({ where: { id }, data: { archived: true } })
    await writeAudit({
      companyId: session.user.companyId, userId: session.user.id,
      action: 'UPDATE', entity: 'Yacht', entityId: id, meta: { archived: true },
    })
    return NextResponse.json({ ok: true, archived: true, boat: archived })
  }

  await prisma.yacht.delete({ where: { id } })
  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id,
    action: 'DELETE', entity: 'Yacht', entityId: id,
  })
  return NextResponse.json({ ok: true, archived: false })
}
