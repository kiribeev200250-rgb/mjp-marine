import { NextResponse } from 'next/server'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'

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
      total: true, clientName: true, clientId: true,
    },
  })

  return NextResponse.json(invoices.map((i) => ({
    ...i, total: i.total.toString(), date: i.date.toISOString(), dueDate: i.dueDate?.toISOString() ?? null,
  })))
}
