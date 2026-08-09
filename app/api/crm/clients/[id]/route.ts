import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { FunnelStage } from '@prisma/client'

// GET /api/crm/clients/[id] — карточка клиента со всей историей
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'VIEW')

  const client = await prisma.client.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      yachts:       true,
      stageHistory: { orderBy: { createdAt: 'desc' } },
      quotes:       { orderBy: { createdAt: 'desc' }, include: { items: true } },
      tasks:        { orderBy: { createdAt: 'desc' } },
      invoices:     { orderBy: { createdAt: 'desc' } },
      finances:     { orderBy: { date: 'desc' } },
    },
  })

  if (!client) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  return NextResponse.json(client)
}

// PATCH /api/crm/clients/[id] — обновить клиента или сменить стадию воронки
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'EDIT')

  const body = await req.json()
  const companyId = session.user.companyId

  const existing = await prisma.client.findFirst({
    where: { id, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const { funnelStage, stageNote, ...rest } = body

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(funnelStage && { funnelStage: funnelStage as FunnelStage }),
    },
  })

  if (funnelStage && funnelStage !== existing.funnelStage) {
    await prisma.funnelHistory.create({
      data: {
        clientId:  id,
        fromStage: existing.funnelStage,
        toStage:   funnelStage as FunnelStage,
        note:      stageNote ?? '',
      },
    })

    await writeAudit({
      companyId,
      userId:   session.user.id,
      action:   'STATUS_CHANGE',
      entity:   'Client',
      entityId: id,
      oldValue: { funnelStage: existing.funnelStage },
      newValue: { funnelStage },
    })
  } else {
    await writeAudit({
      companyId,
      userId:   session.user.id,
      action:   'UPDATE',
      entity:   'Client',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    })
  }

  return NextResponse.json(updated)
}

// DELETE /api/crm/clients/[id] — мягкое удаление (active = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'DELETE')

  const companyId = session.user.companyId
  const existing  = await prisma.client.findFirst({
    where: { id, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.client.update({ where: { id }, data: { active: false } })

  await writeAudit({
    companyId,
    userId:   session.user.id,
    action:   'DELETE',
    entity:   'Client',
    entityId: id,
    oldValue: { firstName: existing.firstName, lastName: existing.lastName },
  })

  return NextResponse.json({ ok: true })
}
