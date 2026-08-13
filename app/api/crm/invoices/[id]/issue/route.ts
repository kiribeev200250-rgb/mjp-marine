import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { writeOffInvoiceMaterials } from '@/lib/crm/services/invoiceCascade'
import { companyInfoSnapshot } from '@/lib/crm/documentJobs'
import { prisma } from '@/lib/prisma'

// POST — выпустить черновик счёта: назначает сквозной номер (только тут он
// расходуется) и переводит статус DRAFT → ISSUED. Необратимо для нумерации,
// поэтому черновик стоит доредактировать ДО выпуска.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Счёт уже выпущен' }, { status: 400 })
  }

  const companyInfo = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })
  if (!companyInfo || companyInfo.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ') {
    return NextResponse.json({ error: 'Заполните реквизиты компании в настройках перед выставлением счёта' }, { status: 400 })
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const { number, year, sequenceNum } = await nextDocumentNumber(tx, session.user.companyId, 'invoice')

      const inv = await tx.invoice.update({
        where: { id },
        data: { number, year, sequenceNum, status: 'ISSUED', date: new Date(), ...companyInfoSnapshot(companyInfo) },
        include: { jobs: { include: { materials: true } } },
      })

      await tx.client.update({ where: { id: inv.clientId }, data: { funnelStage: 'INVOICE_SENT' } })
      await tx.funnelHistory.create({
        data: { clientId: inv.clientId, toStage: 'INVOICE_SENT', note: `Счёт ${inv.number} выпущен из черновика` },
      })

      const cascade = await writeOffInvoiceMaterials(tx, session.user.companyId, inv, inv.jobs)

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId:    session.user.id,
          action:    'STATUS_CHANGE',
          entity:    'Invoice',
          entityId:  inv.id,
          oldValue:  { status: 'DRAFT', number: existing.number },
          newValue:  { status: 'ISSUED', number: inv.number },
          meta:      { cascade },
        },
      })

      return { ...inv, cascade, materialsWrittenOff: true }
    })

    return NextResponse.json(invoice)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
