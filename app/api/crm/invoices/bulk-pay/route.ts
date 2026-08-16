import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { recordPayment } from '@/lib/crm/services/invoiceCascade'
import { prisma } from '@/lib/prisma'

const MAX_IDS = 100
const PAYABLE_STATUSES = new Set(['ISSUED', 'PARTIAL', 'OVERDUE'])

// PATCH /api/crm/invoices/bulk-pay — «Пометить оплаченными» для нескольких
// счетов разом (та же кнопка на странице счёта, просто по списку). Идемпотентно:
// уже PAID пропускается без ошибки, DRAFT/CANCELLED пропускается тоже (их
// нельзя оплатить напрямую) — счёт просто не попадает в paidIds, вся пачка
// не откатывается из-за одного неподходящего счёта. Один $transaction на
// весь батч — тот же recordPayment-каскад, что и одиночная оплата.
export async function PATCH(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { ids } = body as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Не выбрано ни одного счёта' }, { status: 400 })
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Слишком много счетов за раз (максимум ${MAX_IDS})` }, { status: 400 })
  }

  const found = await prisma.invoice.findMany({ where: { id: { in: ids }, companyId: session.user.companyId } })
  const skippedIds = ids.filter((id) => !found.some((i) => i.id === id))

  try {
    const { paidIds, alreadyPaidIds, notPayableIds } = await prisma.$transaction(async (tx) => {
      const paidIds: string[] = []
      const alreadyPaidIds: string[] = []
      const notPayableIds: string[] = []

      for (const existing of found) {
        if (existing.status === 'PAID') { alreadyPaidIds.push(existing.id); continue }
        if (!PAYABLE_STATUSES.has(existing.status)) { notPayableIds.push(existing.id); continue }

        const cascade = await recordPayment(tx, session.user.companyId, existing, existing.paymentMethod)

        await tx.auditLog.create({
          data: {
            companyId: session.user.companyId,
            userId:    session.user.id,
            action:    'STATUS_CHANGE',
            entity:    'Invoice',
            entityId:  existing.id,
            oldValue:  { status: existing.status },
            newValue:  { status: 'PAID' },
            meta:      { bulk: true, batchSize: found.length, cascade },
          },
        })
        paidIds.push(existing.id)
      }

      return { paidIds, alreadyPaidIds, notPayableIds }
    })

    return NextResponse.json({ ok: true, paidIds, alreadyPaidIds, notPayableIds, skippedIds })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
