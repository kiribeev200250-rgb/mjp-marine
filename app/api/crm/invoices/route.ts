import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { parseJobsInput, jobsToCreateInput, type JobInput } from '@/lib/crm/documentJobs'
import { writeOffInvoiceMaterials } from '@/lib/crm/services/invoiceCascade'
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

// POST /api/crm/invoices — создать счёт вручную (не из пресмета)
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')

  const body = await req.json()
  const {
    clientId, boatId, language, dueDate, ivaRate, irpfRate, paymentMethod, notes, jobs,
    clientNif, clientAddress, asDraft,
  } = body as {
    clientId: string
    boatId?: string | null
    language?: string
    dueDate?: string
    ivaRate?: string | number
    irpfRate?: string | number
    paymentMethod?: string
    notes?: string
    jobs: JobInput[]
    clientNif?: string
    clientAddress?: string
    asDraft?: boolean
  }

  if (!clientId) return NextResponse.json({ error: 'Выберите клиента' }, { status: 400 })

  const client = await prisma.client.findFirst({ where: { id: clientId, companyId: session.user.companyId } })
  if (!client) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })

  if (boatId) {
    const boat = await prisma.yacht.findFirst({ where: { id: boatId, clientId } })
    if (!boat) return NextResponse.json({ error: 'Лодка не найдена у этого клиента' }, { status: 404 })
  }

  const companyInfo = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })
  if (!companyInfo || companyInfo.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ') {
    return NextResponse.json({ error: 'Заполните реквизиты компании в настройках перед выставлением счёта' }, { status: 400 })
  }

  let parsedJobs, jobsTotal, materialsTotal
  try {
    ;({ jobs: parsedJobs, jobsTotal, materialsTotal } = parseJobsInput(jobs))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректные позиции' }, { status: 400 })
  }

  const subtotal   = jobsTotal.plus(materialsTotal)
  const iva        = new Decimal(ivaRate ?? 21)
  const irpf       = new Decimal(irpfRate ?? 0)
  if (iva.lt(0) || iva.gt(100))  return NextResponse.json({ error: 'Ставка IVA должна быть от 0 до 100%' },  { status: 400 })
  if (irpf.lt(0) || irpf.gt(100)) return NextResponse.json({ error: 'Ставка IRPF должна быть от 0 до 100%' }, { status: 400 })
  const ivaAmount  = subtotal.times(iva).div(100)
  const irpfAmount = subtotal.times(irpf).div(100)
  const total      = subtotal.plus(ivaAmount).minus(irpfAmount)

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      // Черновик не занимает сквозной номер — он выдаётся только при явном
      // «Выпустить счёт» (см. /api/crm/invoices/[id]/issue), чтобы опечатка
      // в черновике не оставляла дыру в фискальной нумерации.
      const numbering = asDraft ? null : await nextDocumentNumber(tx, session.user.companyId, 'invoice')
      const number = numbering ? numbering.number : `ЧЕРНОВИК-${Date.now().toString(36)}`

      const inv = await tx.invoice.create({
        data: {
          companyId: session.user.companyId,
          clientId,
          boatId: boatId || null,
          number,
          year:        numbering?.year ?? null,
          sequenceNum: numbering?.sequenceNum ?? null,
          status:        asDraft ? 'DRAFT' : 'ISSUED',
          language:      language || client.language || 'ru',
          dueDate:       dueDate ? new Date(dueDate) : null,
          paymentMethod: paymentMethod ?? '',
          ivaRate:       iva,
          irpfRate:      irpf,
          jobsTotal, materialsTotal, subtotal, ivaAmount, irpfAmount, total,
          clientName:    `${client.firstName} ${client.lastName}`.trim(),
          clientNif:     clientNif ?? '',
          clientAddress: clientAddress ?? '',
          notes:         notes ?? '',
          jobs: { create: jobsToCreateInput(parsedJobs) },
        },
        include: { jobs: { include: { materials: true } } },
      })

      let cascade: string[] = []
      if (!asDraft) {
        await tx.client.update({ where: { id: clientId }, data: { funnelStage: 'INVOICE_SENT' } })
        await tx.funnelHistory.create({
          data: { clientId, toStage: 'INVOICE_SENT', note: `Счёт ${inv.number} выставлен` },
        })
        cascade = await writeOffInvoiceMaterials(tx, session.user.companyId, inv, inv.jobs)
      }

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'CREATE',
          entity:    'Invoice',
          entityId:  inv.id,
          newValue:  { number: inv.number, total: inv.total.toString(), draft: !!asDraft },
          meta:      { cascade },
        },
      })

      return { ...inv, cascade, materialsWrittenOff: !asDraft }
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}