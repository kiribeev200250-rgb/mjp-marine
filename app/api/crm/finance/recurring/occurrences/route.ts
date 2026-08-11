import { NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { ensureOccurrences } from '@/lib/crm/services/recurringExpenses'

// GET /api/crm/finance/recurring/occurrences — «ожидают подтверждения»:
// сначала догенерирует недостающие occurrence на текущий период (идемпотентно),
// затем возвращает все PENDING.
export async function GET() {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  await ensureOccurrences(session.user.companyId)

  const occurrences = await prisma.recurringExpenseOccurrence.findMany({
    where: { status: 'PENDING', recurringExpense: { companyId: session.user.companyId } },
    include: { recurringExpense: true },
    orderBy: { dueDate: 'asc' },
  })

  return NextResponse.json(occurrences)
}
