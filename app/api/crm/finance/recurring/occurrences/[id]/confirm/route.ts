import { NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { confirmOccurrence } from '@/lib/crm/services/recurringExpenses'
import { prisma } from '@/lib/prisma'

// POST /api/crm/finance/recurring/occurrences/[id]/confirm — провести расход
// за этот период. Идемпотентно (двойной клик не задваивает).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  try {
    const result = await prisma.$transaction((tx) => confirmOccurrence(tx, session.user.companyId, id))

    if (!result.skipped) {
      await writeAudit({
        companyId: session.user.companyId, userId: session.user.id, action: 'CREATE',
        entity: 'RecurringExpenseOccurrence', entityId: id, meta: { via: 'confirm' },
      })
    }

    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
