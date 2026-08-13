import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// POST — установить/обновить план (доход/маржа) на месяц
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const { year, month, revenue, margin } = await req.json()
  if (!year || !month) return NextResponse.json({ error: 'Некорректный период' }, { status: 400 })

  const goal = await prisma.kpiGoal.upsert({
    where:  { companyId_year_month: { companyId: session.user.companyId, year, month } },
    create: {
      companyId: session.user.companyId, year, month,
      revenue: new Decimal(revenue || 0), margin: new Decimal(margin || 0),
    },
    update: {
      revenue: new Decimal(revenue || 0), margin: new Decimal(margin || 0),
    },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'KpiGoal', entityId: goal.id, newValue: { year, month, revenue, margin },
  })

  return NextResponse.json(goal)
}
