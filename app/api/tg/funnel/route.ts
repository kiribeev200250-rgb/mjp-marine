import { NextResponse } from 'next/server'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { FunnelStage } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'FUNNEL', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const clients = await prisma.client.findMany({
    where:  { companyId: session.companyId, active: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, firstName: true, lastName: true, marina: true, source: true,
      funnelStage: true, phone: true, email: true,
      invoices: { where: { status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } }, select: { total: true } },
    },
  })

  return NextResponse.json(
    clients.map((c) => ({
      ...c,
      openInvoiceTotal: c.invoices.reduce((s, i) => s + Number(i.total), 0),
      invoices: undefined,
    })),
  )
}

export async function PATCH(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'FUNNEL', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { clientId, toStage } = await req.json() as { clientId: string; toStage: FunnelStage }

  const existing = await prisma.client.findFirst({
    where:  { id: clientId, companyId: session.companyId },
    select: { funnelStage: true },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.funnelStage === toStage) return NextResponse.json({ ok: true })

  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { funnelStage: toStage } }),
    prisma.funnelHistory.create({
      data: { clientId, fromStage: existing.funnelStage, toStage, note: 'Через Telegram Mini App' },
    }),
  ])

  await writeAudit({
    companyId: session.companyId, userId: session.id, action: 'STATUS_CHANGE',
    entity: 'Client', entityId: clientId,
    oldValue: { funnelStage: existing.funnelStage }, newValue: { funnelStage: toStage },
    meta: { via: 'telegram_miniapp' },
  })

  return NextResponse.json({ ok: true })
}
