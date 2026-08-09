import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { prisma } from '@/lib/prisma'

// POST /api/crm/quotes/[id]/convert — создать счёт на основе пресмета
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { items: { orderBy: { sortOrder: 'asc' } }, client: true },
  })
  if (!quote) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })
  if (companyInfo.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ') {
    return NextResponse.json({ error: 'Заполните реквизиты компании в настройках перед выставлением счёта' }, { status: 400 })
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const { number, year, sequenceNum } = await nextDocumentNumber(tx, session.user.companyId, 'invoice')

      const inv = await tx.invoice.create({
        data: {
          companyId:  session.user.companyId,
          clientId:   quote.clientId,
          quoteId:    quote.id,
          number, year, sequenceNum,
          language:   quote.language,
          ivaRate:    quote.ivaRate,
          irpfRate:   companyInfo.irpfRate,
          subtotal:   quote.subtotal,
          ivaAmount:  quote.ivaAmount,
          irpfAmount: quote.subtotal.mul(companyInfo.irpfRate).div(100),
          total:      quote.total.minus(quote.subtotal.mul(companyInfo.irpfRate).div(100)),
          clientName: `${quote.client.firstName} ${quote.client.lastName}`.trim(),
          notes:      quote.notes,
          items: {
            create: quote.items.map((it) => ({
              description: it.description,
              quantity:    it.quantity,
              unitPrice:   it.unitPrice,
              total:       it.total,
              sortOrder:   it.sortOrder,
            })),
          },
        },
        include: { items: true },
      })

      await tx.client.update({ where: { id: quote.clientId }, data: { funnelStage: 'INVOICE_SENT' } })
      await tx.funnelHistory.create({
        data: { clientId: quote.clientId, toStage: 'INVOICE_SENT', note: `Счёт ${inv.number} создан из пресмета ${quote.number}` },
      })

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'CREATE',
          entity:    'Invoice',
          entityId:  inv.id,
          newValue:  { number: inv.number, total: inv.total.toString(), fromQuote: quote.number },
        },
      })

      return inv
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
