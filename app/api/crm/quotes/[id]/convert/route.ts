import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { writeOffInvoiceMaterials } from '@/lib/crm/services/invoiceCascade'
import { companyInfoSnapshot } from '@/lib/crm/documentJobs'
import { prisma } from '@/lib/prisma'

// POST /api/crm/quotes/[id]/convert — создать счёт на основе пресмета
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
    },
  })
  if (!quote) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })
  if (companyInfo.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ') {
    return NextResponse.json({ error: 'Заполните реквизиты компании в настройках перед выставлением счёта' }, { status: 400 })
  }

  const irpfAmount = quote.subtotal.mul(companyInfo.irpfRate).div(100).toDecimalPlaces(2)

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const { number, year, sequenceNum } = await nextDocumentNumber(tx, session.user.companyId, 'invoice')

      const inv = await tx.invoice.create({
        data: {
          companyId:  session.user.companyId,
          clientId:   quote.clientId,
          boatId:     quote.boatId,
          quoteId:    quote.id,
          number, year, sequenceNum,
          language:       quote.language,
          ivaRate:        quote.ivaRate,
          irpfRate:       companyInfo.irpfRate,
          jobsTotal:      quote.jobsTotal,
          materialsTotal: quote.materialsTotal,
          subtotal:       quote.subtotal,
          ivaAmount:      quote.ivaAmount,
          irpfAmount:     irpfAmount,
          total:          quote.total.minus(irpfAmount),
          clientName:     `${quote.client.firstName} ${quote.client.lastName}`.trim(),
          ...companyInfoSnapshot(companyInfo),
          notes:          quote.notes,
          jobs: {
            create: quote.jobs.map((job) => ({
              sortOrder:  job.sortOrder,
              title:      job.title,
              laborHours: job.laborHours,
              laborRate:  job.laborRate,
              quantity:   job.quantity,
              unitPrice:  job.unitPrice,
              laborCost:  job.laborCost,
              materials: {
                create: job.materials.map((m) => ({
                  sortOrder:       m.sortOrder,
                  name:            m.name,
                  quantity:        m.quantity,
                  unitPrice:       m.unitPrice,
                  total:           m.total,
                  inventoryItemId: m.inventoryItemId,
                })),
              },
            })),
          },
        },
        include: { jobs: { include: { materials: true } } },
      })

      await tx.client.update({ where: { id: quote.clientId }, data: { funnelStage: 'INVOICE_SENT' } })
      await tx.funnelHistory.create({
        data: { clientId: quote.clientId, toStage: 'INVOICE_SENT', note: `Счёт ${inv.number} создан из пресмета ${quote.number}` },
      })

      const cascade = await writeOffInvoiceMaterials(tx, session.user.companyId, inv, inv.jobs)

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'CREATE',
          entity:    'Invoice',
          entityId:  inv.id,
          newValue:  { number: inv.number, total: inv.total.toString(), fromQuote: quote.number },
          meta:      { cascade },
        },
      })

      return { ...inv, cascade, materialsWrittenOff: true }
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
