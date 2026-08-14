import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { parseJobsInput, jobsToCreateInput, computeDiscountAmount, type JobInput } from '@/lib/crm/documentJobs'
import { prisma } from '@/lib/prisma'
import type { QuoteStatus, AmountKind } from '@prisma/client'

// GET /api/crm/quotes — список пресметов
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') as QuoteStatus | null
  const q      = searchParams.get('q')?.trim()

  const quotes = await prisma.quote.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status && { status }),
      ...(q && {
        OR: [
          { number: { contains: q, mode: 'insensitive' as const } },
          { client: { firstName: { contains: q, mode: 'insensitive' as const } } },
          { client: { lastName:  { contains: q, mode: 'insensitive' as const } } },
        ],
      }),
    },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(quotes)
}

// POST /api/crm/quotes — создать пресмет
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const body = await req.json()
  const { clientId, boatId, language, validUntil, ivaRate, notes, jobs, discountType, discountValue, depositType, depositValue } = body as {
    clientId: string
    boatId?: string | null
    language?: string
    validUntil?: string
    ivaRate?: string | number
    notes?: string
    jobs: JobInput[]
    discountType?: AmountKind
    discountValue?: string | number
    depositType?: AmountKind
    depositValue?: string | number
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

  const catalogSubtotal = jobsTotal.plus(materialsTotal)
  let discountAmount: Decimal
  try {
    discountAmount = computeDiscountAmount(catalogSubtotal, discountType, discountValue)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная скидка' }, { status: 400 })
  }
  const subtotal  = catalogSubtotal.minus(discountAmount)
  const rate      = new Decimal(ivaRate ?? 21)
  const ivaAmount = subtotal.times(rate).div(100).toDecimalPlaces(2)
  const total     = subtotal.plus(ivaAmount)

  try {
    const quote = await prisma.$transaction(async (tx) => {
      const { number } = await nextDocumentNumber(tx, session.user.companyId, 'quote')

      const q = await tx.quote.create({
        data: {
          companyId:  session.user.companyId,
          clientId,
          boatId:     boatId || null,
          number,
          language:   language || client.language || 'ru',
          validUntil: validUntil ? new Date(validUntil) : null,
          ivaRate:    rate,
          jobsTotal,
          materialsTotal,
          discountType:  discountType  ?? 'NONE',
          discountValue: new Decimal(discountValue ?? 0),
          discountAmount,
          subtotal,
          ivaAmount,
          total,
          depositType:   depositType   ?? 'NONE',
          depositValue:  new Decimal(depositValue  ?? 0),
          notes:      notes ?? '',
          jobs: { create: jobsToCreateInput(parsedJobs) },
        },
        include: { jobs: { include: { materials: true } }, client: true },
      })

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'CREATE',
          entity:    'Quote',
          entityId:  q.id,
          newValue:  { number: q.number, total: q.total.toString() },
        },
      })

      return q
    })

    return NextResponse.json(quote, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
