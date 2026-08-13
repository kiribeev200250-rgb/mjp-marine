import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { reversePayment } from '@/lib/crm/services/invoiceCascade'
import { prisma } from '@/lib/prisma'

// POST — отменить оплату счёта: сторнирует FinanceEntry (доход убирается из
// P&L/кассы), счёт возвращается в «Выставлен» и снова попадает в дебиторку.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (existing.status !== 'PAID' && existing.status !== 'PARTIAL') {
    return NextResponse.json({ error: 'Счёт не оплачен' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cascade = await reversePayment(tx, session.user.companyId, session.user.id, existing)
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id } })
      return { ...inv, cascade }
    })

    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
