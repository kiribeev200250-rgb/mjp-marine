import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// POST /api/crm/tasks/[id]/reminder — сезонное напоминание/лид от выполненной
// задачи (напр. «антифулинг через 12 мес»). Cron (app/api/crm/cron/reminders)
// в срок создаст новую задачу-бэклог для клиента и уведомит владельца.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'CREATE')

  const task = await prisma.task.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!task) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { title, monthsAhead } = body as { title?: string; monthsAhead?: number }

  if (!title?.trim()) return NextResponse.json({ error: 'Укажите текст напоминания' }, { status: 400 })
  const months = Number(monthsAhead)
  if (!months || months < 1 || months > 60) return NextResponse.json({ error: 'Через сколько месяцев? (1-60)' }, { status: 400 })

  const scheduledAt = new Date()
  scheduledAt.setMonth(scheduledAt.getMonth() + months)

  const reminder = await prisma.reminder.create({
    data: {
      companyId: session.user.companyId,
      type: 'SEASONAL_SERVICE',
      title: title.trim(),
      scheduledAt,
      clientId: task.clientId,
      taskId: task.id,
    },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'CREATE',
    entity: 'Reminder', entityId: reminder.id,
    newValue: { title, scheduledAt: scheduledAt.toISOString() }, meta: { fromTaskId: task.id },
  })

  return NextResponse.json(reminder, { status: 201 })
}
