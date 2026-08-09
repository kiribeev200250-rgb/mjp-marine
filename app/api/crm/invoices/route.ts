import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { prisma } from '@/lib/prisma'
import type { InvoiceStatus } from '@prisma/client'

// GET /api/crm/invoices — список счетов
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') as InvoiceStatus | null
  const q      = searchParams.get('q')?.trim()

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status && { status }),
      ...(q && {
        OR: [
          { number: { contains: q, mode: 'insensitive' as const } },
          { clientName: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  })

  return NextResponse.json(invoices)
}

interface ItemInput { description: string; quantity: string | number; unitPrice: string | number }

// POST /api/crm/invoices — создать счёт вручную (не из пресмета)
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')

  const body = await req.json()
  const {
    clientId, language, dueDate, ivaRate, irpfRate, paymentMethod, notes, items,
    clientNif, clientAddress,
  } = body as {
    clientId: string
    language?: string
    dueDate?: string
    ivaRate?: string | number
    irpfRate?: string | number
    paymentMethod?: string
    notes?: string
    items: ItemInput[]
    clientNif?: string
    clientAddress?: string
  }

  if (!clientId) return NextResponse.json({ error: 'Выберите клиента' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Добавьте хотя бы одну позицию' }, { status: 400 })
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, companyId: session.user.companyId } })
  if (!client) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })

  const companyInfo = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })
  if (!companyInfo || companyInfo.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ') {
    return NextResponse.json({ error: 'Заполните реквизиты компании в настройках перед выставлением счёта' }, { status: 400 })
  }

  let parsedItems
  try {
    parsedItems = items.map((it) => {
      const qty   = new Decimal(it.quantity || 0)
      const price = new Decimal(it.unitPrice || 0)
      if (!it.description?.trim()) throw new Error('Заполните описание позиции')
      if (qty.lte(0)) throw new Error('Количество должно быть больше нуля')
      return { description: it.description.trim(), quantity: qty, unitPrice: price, total: qty.times(price) }
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректные позиции' }, { status: 400 })
  }

  const subtotal   = parsedItems.reduce((s, it) => s.plus(it.total), new Decimal(0))
  const iva        = new Decimal(ivaRate ?? 21)
  const irpf       = new Decimal(irpfRate ?? 0)
  const ivaAmount  = subtotal.times(iva).div(100)
  const irpfAmount = subtotal.times(irpf).div(100)
  const total      = subtotal.plus(ivaAmount).minus(irpfAmount)

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const { number, year, sequenceNum } = await nextDocumentNumber(tx, session.user.companyId, 'invoice')

      const inv = await tx.invoice.create({
        data: {
          companyId: session.user.companyId,
          clientId,
          number, year, sequenceNum,
          language:      language || client.language || 'ru',
          dueDate:       dueDate ? new Date(dueDate) : null,
          paymentMethod: paymentMethod ?? '',
          ivaRate:       iva,
          irpfRate:      irpf,
          subtotal, ivaAmount, irpfAmount, total,
          clientName:    `${client.firstName} ${client.lastName}`.trim(),
          clientNif:     clientNif ?? '',
          clientAddress: clientAddress ?? '',
          notes:         notes ?? '',
          items: {
            create: parsedItems.map((it, i) => ({
              description: it.description,
              quantity:    it.quantity,
              unitPrice:   it.unitPrice,
              total:       it.total,
              sortOrder:   i,
            })),
          },
        },
        include: { items: true },
      })

      await tx.client.update({ where: { id: clientId }, data: { funnelStage: 'INVOICE_SENT' } })
      await tx.funnelHistory.create({
        data: { clientId, toStage: 'INVOICE_SENT', note: `Счёт ${inv.number} выставлен` },
      })

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'CREATE',
          entity:    'Invoice',
          entityId:  inv.id,
          newValue:  { number: inv.number, total: inv.total.toString() },
        },
      })

      return inv
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}