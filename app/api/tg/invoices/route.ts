import { NextResponse } from 'next/server'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { outstandingBalances } from '@/lib/crm/services/ar'

// GET /api/tg/invoices — дебиторка: неоплаченные счета (ISSUED/PARTIAL/OVERDUE)
export async function GET(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'INVOICES', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { companyId: session.companyId, status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
    orderBy: [{ dueDate: 'asc' }, { date: 'asc' }],
    select: {
      id: true, number: true, status: true, date: true, dueDate: true,
      total: true, ivaRate: true, clientName: true, clientId: true,
    },
  })

  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const balances = await outstandingBalances(invoices)

  return NextResponse.json(invoices.map((i) => ({
    ...i, total: balances.get(i.id)!.toString(), date: i.date.toISOString(), dueDate: i.dueDate?.toISOString() ?? null,
  })))
}
