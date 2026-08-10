import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'

// POST — дублировать счёт (любого статуса) в новый черновик: тот же клиент,
// позиции и ставки, но новый id, без номера/даты выпуска. Используется и как
// «поправить ошибку», и как основа для корректирующего счёта — новый черновик
// свободно редактируется и получает собственный номер только при выпуске.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')

  const source = await prisma.invoice.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: { jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } } },
  })
  if (!source) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          companyId:     session.user.companyId,
          clientId:      source.clientId,
          number:        `ЧЕРНОВИК-${Date.now().toString(36)}`,
          year:           null,
          sequenceNum:    null,
          status:        'DRAFT',
          language:       source.language,
          paymentMethod:  source.paymentMethod,
          ivaRate:        source.ivaRate,
          irpfRate:       source.irpfRate,
          jobsTotal:      source.jobsTotal,
          materialsTotal: source.materialsTotal,
          subtotal:       source.subtotal,
          ivaAmount:      source.ivaAmount,
          irpfAmount:     source.irpfAmount,
          total:          source.total,
          clientName:     source.clientName,
          clientNif:      source.clientNif,
          clientAddress:  source.clientAddress,
          notes:          source.notes,
          jobs: {
            create: source.jobs.map((job) => ({
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

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'CREATE',
          entity:    'Invoice',
          entityId:  inv.id,
          newValue:  { duplicatedFrom: source.number },
        },
      })

      return inv
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
