import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { recordDeposit } from '@/lib/crm/services/invoiceCascade'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// POST /api/crm/invoices/[id]/deposit — зафиксировать фактически полученный
// аванс (частичная оплата до/в момент выставления). Сумма — брутто (с IVA),
// как её и озвучивают клиенту («внесите 30% сейчас»); IVA/нетто считает
// recordDeposit по ivaRate счёта.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status === 'DRAFT') {
    return NextResponse.json({ error: 'Сначала выпустите счёт — у черновика ещё нет фискального номера' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  let amount: Decimal
  try {
    amount = new Decimal(String(body?.amount ?? '0'))
  } catch {
    return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 })
  }
  const paymentMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod : undefined

  try {
    const lines = await prisma.$transaction((tx) =>
      recordDeposit(tx, session.user.companyId, existing, amount, paymentMethod),
    )

    await writeAudit({
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'RECORD_DEPOSIT',
      entity:    'Invoice',
      entityId:  id,
      newValue:  { amount: amount.toString() },
      meta:      { cascade: lines },
    })

    return NextResponse.json({ ok: true, lines })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
