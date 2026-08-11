import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { refundPayment } from '@/lib/crm/services/invoiceCascade'
import { prisma } from '@/lib/prisma'

// POST /api/crm/invoices/[id]/refund — возврат (полный/частичный) уже
// проведённой оплаты. Тело: { amount: string, reason?: string } — сумма нетто
// (без IVA); IVA repercutido корректируется пропорционально ставке счёта.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { amount, reason } = body as { amount?: string | number; reason?: string }

  let netRefundAmount: Decimal
  try {
    netRefundAmount = new Decimal(String(amount ?? '0'))
    if (netRefundAmount.lte(0)) throw new Error('Сумма возврата должна быть больше нуля')
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cascade = await refundPayment(tx, session.user.companyId, session.user.id, existing, netRefundAmount, reason?.trim())
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id } })
      return { ...inv, cascade }
    })

    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
