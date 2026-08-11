import { NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { skipOccurrence } from '@/lib/crm/services/recurringExpenses'

// POST /api/crm/finance/recurring/occurrences/[id]/skip — «в этом периоде не было» —
// не создаёт FinanceEntry, просто снимает occurrence с ожидания.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')

  await skipOccurrence(session.user.companyId, id)

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'RecurringExpenseOccurrence', entityId: id, meta: { via: 'skip' },
  })

  return NextResponse.json({ ok: true })
}
