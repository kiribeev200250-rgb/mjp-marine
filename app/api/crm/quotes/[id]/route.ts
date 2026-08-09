import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { QuoteStatus } from '@prisma/client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { items: { orderBy: { sortOrder: 'asc' } }, client: true, invoices: { select: { id: true, number: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  return NextResponse.json(quote)
}

// PATCH — смена статуса (SENT/ACCEPTED/REJECTED) или примечаний
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const existing = await prisma.quote.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { status, notes } = body as { status?: QuoteStatus; notes?: string }

  const data: { status?: QuoteStatus; notes?: string; acceptedAt?: Date } = {}
  if (status) {
    data.status = status
    if (status === 'ACCEPTED') data.acceptedAt = new Date()
  }
  if (notes !== undefined) data.notes = notes

  const updated = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.update({ where: { id }, data })

    if (status && status === 'ACCEPTED') {
      await tx.client.update({ where: { id: q.clientId }, data: { funnelStage: 'WORK_SCHEDULED' } })
      await tx.funnelHistory.create({
        data: { clientId: q.clientId, fromStage: existing.status === 'SENT' ? 'QUOTE_SENT' : undefined, toStage: 'WORK_SCHEDULED', note: `Пресмет ${q.number} принят` },
      })
    }

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'STATUS_CHANGE',
        entity:    'Quote',
        entityId:  q.id,
        oldValue:  { status: existing.status },
        newValue:  { status: q.status },
      },
    })

    return q
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'DELETE')

  const existing = await prisma.quote.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Можно удалить только черновик' }, { status: 400 })
  }

  await prisma.quote.delete({ where: { id } })
  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'DELETE',
    entity:    'Quote',
    entityId:  id,
  })

  return NextResponse.json({ ok: true })
}
