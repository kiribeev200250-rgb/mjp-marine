import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
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

async function nextIncomeAutoId(companyId: string, year: number): Promise<string> {
  const count = await prisma.financeEntry.count({
    where: {
      companyId,
      type: 'INCOME',
      date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    },
  })
  return `INC-${year}-${String(count + 1).padStart(3, '0')}`
}

// PATCH — смена статуса (в т.ч. оплата → создаёт FinanceEntry), способа оплаты, срока
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
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(paymentMethod !== undefined && { paymentMethod }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(notes !== undefined && { notes }),
          ...(becamePaid && { paidAt: new Date() }),
        },
      })

      if (becamePaid) {
        const year = new Date().getFullYear()
        const autoId = await nextIncomeAutoId(session.user.companyId, year)
        await tx.financeEntry.create({
          data: {
            companyId:     session.user.companyId,
            autoId,
            type:          'INCOME',
            date:          new Date(),
            category:      'Оплата по счёту',
            amountExpr:    inv.total.toString(),
            amount:        inv.total,
            paymentMethod: inv.paymentMethod || paymentMethod || '',
            description:   `Оплата счёта ${inv.number}`,
            clientId:      inv.clientId,
            invoiceId:     inv.id,
          },
        })
        await tx.client.update({ where: { id: inv.clientId }, data: { funnelStage: 'PAID' } })
        await tx.funnelHistory.create({
          data: { clientId: inv.clientId, fromStage: 'INVOICE_SENT', toStage: 'PAID', note: `Счёт ${inv.number} оплачен` },
        })
      }

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    status ? 'STATUS_CHANGE' : 'UPDATE',
          entity:    'Invoice',
          entityId:  inv.id,
          oldValue:  { status: existing.status },
          newValue:  { status: inv.status },
        },
      })

      return inv
    })

    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}

// DELETE — отменить счёт (не удаляет, чтобы не ломать сквозную нумерацию)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'DELETE')

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status === 'PAID') {
    return NextResponse.json({ error: 'Нельзя отменить оплаченный счёт' }, { status: 400 })
  }

  const updated = await prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } })
  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'STATUS_CHANGE',
    entity:    'Invoice',
    entityId:  id,
    oldValue:  { status: existing.status },
    newValue:  { status: 'CANCELLED' },
  })

  return NextResponse.json(updated)
}
