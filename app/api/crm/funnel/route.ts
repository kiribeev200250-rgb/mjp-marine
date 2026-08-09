import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { FunnelStage, ClientSource } from '@prisma/client'

// GET /api/crm/funnel — все клиенты сгруппированные по стадиям (для канбана)
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FUNNEL', 'VIEW')

  const { searchParams } = req.nextUrl
  const marina  = searchParams.get('marina')
  const source  = searchParams.get('source')

  const clients = await prisma.client.findMany({
    where: {
      companyId: session.user.companyId,
      active:    true,
      ...(marina && { marina }),
      ...(source && { source: source as ClientSource }),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id:         true,
      firstName:  true,
      lastName:   true,
      marina:     true,
      source:     true,
      funnelStage: true,
      updatedAt:  true,
      phone:      true,
      language:   true,
      _count: { select: { invoices: true, tasks: true } },
      invoices: {
        where:  { status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
        select: { total: true },
      },
    },
  })

  return NextResponse.json(clients)
}

// PATCH /api/crm/funnel — сменить стадию (drag-and-drop)
export async function PATCH(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FUNNEL', 'EDIT')

  const { clientId, toStage, note } = await req.json() as {
    clientId: string
    toStage:  FunnelStage
    note?:    string
  }

  const existing = await prisma.client.findFirst({
    where: { id: clientId, companyId: session.user.companyId },
    select: { funnelStage: true },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.funnelStage === toStage) return NextResponse.json({ ok: true })

  await prisma.$transaction([
    prisma.client.update({
      where: { id: clientId },
      data:  { funnelStage: toStage },
    }),
    prisma.funnelHistory.create({
      data: {
        clientId,
        fromStage: existing.funnelStage,
        toStage,
        note: note ?? '',
      },
    }),
  ])

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'STATUS_CHANGE',
    entity:    'Client',
    entityId:  clientId,
    oldValue:  { funnelStage: existing.funnelStage },
    newValue:  { funnelStage: toStage },
  })

  return NextResponse.json({ ok: true })
}
