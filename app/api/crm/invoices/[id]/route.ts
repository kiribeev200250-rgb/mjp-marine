import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { parseJobsInput, jobsToCreateInput, type JobInput } from '@/lib/crm/documentJobs'
import { recordPayment, returnInvoiceMaterials, refundPayment } from '@/lib/crm/services/invoiceCascade'
import { prisma } from '@/lib/prisma'
import type { InvoiceStatus } from '@prisma/client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
      quote: { select: { id: true, number: true } },
      finances: true,
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  return NextResponse.json(invoice)
}

// PATCH — смена статуса (в т.ч. оплата → создаёт FinanceEntry через каскад), способа оплаты, срока
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { status, paymentMethod, dueDate, notes } = body as {
    status?: InvoiceStatus
    paymentMethod?: string
    dueDate?: string | null
    notes?: string
  }

  const becamePaid = status === 'PAID' && existing.status !== 'PAID'

  try {
    const result = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: {
          ...(status && !becamePaid && { status }),
          ...(paymentMethod !== undefined && { paymentMethod }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(notes !== undefined && { notes }),
        },
      })

      const cascade = becamePaid
        ? await recordPayment(tx, session.user.companyId, inv, paymentMethod)
        : []

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    status ? 'STATUS_CHANGE' : 'UPDATE',
          entity:    'Invoice',
          entityId:  inv.id,
          oldValue:  { status: existing.status },
          newValue:  { status: becamePaid ? 'PAID' : inv.status },
          meta:      { cascade },
        },
      })

      return { ...inv, status: becamePaid ? 'PAID' as const : inv.status, cascade }
    })

    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}

// PUT — полное редактирование счёта. Разрешено ТОЛЬКО для черновика (DRAFT) —
// у него ещё нет сквозного номера, поэтому переписывать позиции безопасно.
// Выпущенный счёт (номер уже занят фискально) не редактируется — см.
// /api/crm/invoices/[id]/duplicate для «дубликата»/корректировки.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Выпущенный счёт нельзя редактировать напрямую — используйте «Дублировать»' }, { status: 400 })
  }

  const body = await req.json()
  const {
    clientId, boatId, language, dueDate, ivaRate, irpfRate, paymentMethod, notes, jobs,
    clientNif, clientAddress,
  } = body as {
    clientId: string
    boatId?: string | null
    language?: string
    dueDate?: string | null
    ivaRate?: string | number
    irpfRate?: string | number
    paymentMethod?: string
    notes?: string
    jobs: JobInput[]
    clientNif?: string
    clientAddress?: string
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

  const subtotal   = jobsTotal.plus(materialsTotal)
  const iva        = new Decimal(ivaRate ?? existing.ivaRate)
  const irpf       = new Decimal(irpfRate ?? existing.irpfRate)
  if (iva.lt(0) || iva.gt(100))  return NextResponse.json({ error: 'Ставка IVA должна быть от 0 до 100%' },  { status: 400 })
  if (irpf.lt(0) || irpf.gt(100)) return NextResponse.json({ error: 'Ставка IRPF должна быть от 0 до 100%' }, { status: 400 })
  const ivaAmount  = subtotal.times(iva).div(100)
  const irpfAmount = subtotal.times(irpf).div(100)
  const total      = subtotal.plus(ivaAmount).minus(irpfAmount)

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceJob.deleteMany({ where: { invoiceId: id } })

      const inv = await tx.invoice.update({
        where: { id },
        data: {
          clientId,
          boatId:        boatId !== undefined ? (boatId || null) : existing.boatId,
          language:      language || client.language || existing.language,
          dueDate:       dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
          paymentMethod: paymentMethod ?? existing.paymentMethod,
          ivaRate:       iva,
          irpfRate:      irpf,
          jobsTotal, materialsTotal, subtotal, ivaAmount, irpfAmount, total,
          clientName:    `${client.firstName} ${client.lastName}`.trim(),
          clientNif:     clientNif ?? existing.clientNif,
          clientAddress: clientAddress ?? existing.clientAddress,
          notes:         notes ?? existing.notes,
          jobs: { create: jobsToCreateInput(parsedJobs) },
        },
        include: { jobs: { include: { materials: true } } },
      })

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'UPDATE',
          entity:    'Invoice',
          entityId:  inv.id,
          oldValue:  { total: existing.total.toString() },
          newValue:  { total: inv.total.toString() },
        },
      })

      return inv
    })

    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}

// DELETE — черновик удаляется безвозвратно (номер не занят); выпущенный счёт
// только отменяется (CANCELLED), чтобы не ломать сквозную нумерацию.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'DELETE')

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  if (existing.status === 'DRAFT') {
    await prisma.invoice.delete({ where: { id } })
    await writeAudit({
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'DELETE',
      entity:    'Invoice',
      entityId:  id,
      meta:      { draft: true },
    })
    return NextResponse.json({ ok: true })
  }

  const result = await prisma.$transaction(async (tx) => {
    const cascade: string[] = []

    // Аннулирование оплаченного/частично оплаченного счёта сначала полностью
    // сторнирует зачтённый доход (и его IVA repercutido) — деньги не пропадают
    // молча, остаются видны как возврат в истории.
    if (existing.status === 'PAID' || existing.status === 'PARTIAL') {
      const paidEntries = await tx.financeEntry.findMany({ where: { invoiceId: id, type: 'INCOME' } })
      const paidNet = paidEntries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
      if (paidNet.gt(0)) {
        cascade.push(...await refundPayment(tx, session.user.companyId, session.user.id, existing, paidNet, 'Аннулирование счёта'))
      }
    }

    cascade.push(...(existing.materialsWrittenOff
      ? await returnInvoiceMaterials(tx, session.user.companyId, existing)
      : []))

    const updated = await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED' } })

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'STATUS_CHANGE',
        entity:    'Invoice',
        entityId:  id,
        oldValue:  { status: existing.status },
        newValue:  { status: 'CANCELLED' },
        meta:      { cascade },
      },
    })

    return { ...updated, cascade }
  })

  return NextResponse.json(result)
}
