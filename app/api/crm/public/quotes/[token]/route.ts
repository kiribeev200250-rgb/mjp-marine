import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/crm/public/quotes/[token] — публичный просмотр пресмета (без авторизации)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: { select: { firstName: true, lastName: true } },
      company: { include: { companyInfo: true } },
    },
  })
  if (!quote) return NextResponse.json({ error: 'Пресмет не найден' }, { status: 404 })

  return NextResponse.json({
    number:         quote.number,
    status:         quote.status,
    language:       quote.language,
    validUntil:     quote.validUntil,
    createdAt:      quote.createdAt,
    acceptedAt:     quote.acceptedAt,
    clientName:     `${quote.client.firstName} ${quote.client.lastName}`.trim(),
    jobs:           quote.jobs,
    jobsTotal:      quote.jobsTotal,
    materialsTotal: quote.materialsTotal,
    subtotal:       quote.subtotal,
    ivaRate:        quote.ivaRate,
    ivaAmount:      quote.ivaAmount,
    total:          quote.total,
    notes:          quote.notes,
    companyName:    quote.company.companyInfo?.legalName ?? quote.company.name,
  })
}

// POST /api/crm/public/quotes/[token] — принять/отклонить пресмет (без авторизации)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json().catch(() => ({}))
  const action = body?.action as 'accept' | 'reject' | undefined

  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'Некорректное действие' }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({ where: { publicToken: token } })
  if (!quote) return NextResponse.json({ error: 'Пресмет не найден' }, { status: 404 })
  if (quote.status === 'ACCEPTED' || quote.status === 'REJECTED') {
    return NextResponse.json({ error: 'Решение уже принято' }, { status: 409 })
  }

  const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED'

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data:  { status: newStatus, acceptedAt: newStatus === 'ACCEPTED' ? new Date() : undefined },
    })

    if (newStatus === 'ACCEPTED') {
      await tx.client.update({ where: { id: quote.clientId }, data: { funnelStage: 'WORK_SCHEDULED' } })
      await tx.funnelHistory.create({
        data: { clientId: quote.clientId, toStage: 'WORK_SCHEDULED', note: `Пресмет ${quote.number} принят клиентом онлайн` },
      })
    }

    await tx.auditLog.create({
      data: {
        companyId: quote.companyId,
        action:    'STATUS_CHANGE',
        entity:    'Quote',
        entityId:  quote.id,
        oldValue:  { status: quote.status },
        newValue:  { status: newStatus },
        meta:      { via: 'public_link' },
      },
    })
  })

  return NextResponse.json({ ok: true, status: newStatus })
}