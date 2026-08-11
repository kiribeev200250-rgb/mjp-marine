import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { parseJobsInput, jobsToCreateInput, type JobInput } from '@/lib/crm/documentJobs'
import { prisma } from '@/lib/prisma'
import type { QuoteStatus } from '@prisma/client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
      invoices: { select: { id: true, number: true } },
    },
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

// PUT — полное редактирование пресмета (клиент, язык, работы/материалы, суммы).
// Presupuesto не фискальный документ со сквозной нумерацией — редактируется в любом статусе.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const existing = await prisma.quote.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { clientId, boatId, language, validUntil, ivaRate, notes, jobs } = body as {
    clientId: string
    boatId?: string | null
    language?: string
    validUntil?: string | null
    ivaRate?: string | number
    notes?: string
    jobs: JobInput[]
  }

  if (!clientId) return NextResponse.json({ error: 'Выберите клиента' }, { status: 400 })
  const client = await prisma.client.findFirst({ where: { id: clientId, companyId: session.user.companyId } })
  if (!client) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })

  if (boatId) {
    const boat = await prisma.yacht.findFirst({ where: { id: boatId, clientId } })
    if (!boat) return NextResponse.json({ error: 'Лодка не найдена у этого клиента' }, { status: 404 })
  }

  let parsedJobs, jobsTotal, materialsTotal
  try {
    ;({ jobs: parsedJobs, jobsTotal, materialsTotal } = parseJobsInput(jobs))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректные позиции' }, { status: 400 })
  }

  const subtotal  = jobsTotal.plus(materialsTotal)
  const rate      = new Decimal(ivaRate ?? existing.ivaRate)
  const ivaAmount = subtotal.times(rate).div(100)
  const total     = subtotal.plus(ivaAmount)

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Полная замена работ/материалов проще и надёжнее диффинга — QuoteJob
      // каскадно удаляет свои QuoteMaterial, привязок извне на них нет.
      await tx.quoteJob.deleteMany({ where: { quoteId: id } })

      const q = await tx.quote.update({
        where: { id },
        data: {
          clientId,
          boatId:     boatId !== undefined ? (boatId || null) : existing.boatId,
          language:   language || client.language || existing.language,
          validUntil: validUntil ? new Date(validUntil) : null,
          ivaRate:    rate,
          jobsTotal,
          materialsTotal,
          subtotal,
          ivaAmount,
          total,
          notes:      notes ?? existing.notes,
          jobs: { create: jobsToCreateInput(parsedJobs) },
        },
        include: { jobs: { include: { materials: true } }, client: true },
      })

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'UPDATE',
          entity:    'Quote',
          entityId:  q.id,
          oldValue:  { total: existing.total.toString() },
          newValue:  { total: q.total.toString() },
        },
      })

      return q
    })

    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
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
