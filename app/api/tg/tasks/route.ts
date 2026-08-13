import { NextResponse } from 'next/server'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import { taskScopeWhere } from '@/lib/crm/scope'

// GET /api/tg/tasks — задачи на сегодня + бэклог
export async function GET(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'SCHEDULE', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const [today, backlog] = await Promise.all([
    prisma.task.findMany({
      where: {
        companyId: session.companyId,
        scheduledAt: { gte: todayStart, lt: todayEnd },
        ...taskScopeWhere(session),
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
      include: { client: { select: { id: true, firstName: true, lastName: true, marina: true } } },
    }),
    prisma.task.findMany({
      where: { companyId: session.companyId, isBacklog: true, status: { notIn: ['DONE'] }, ...taskScopeWhere(session) },
      orderBy: { createdAt: 'asc' },
      include: { client: { select: { id: true, firstName: true, lastName: true, marina: true } } },
    }),
  ])

  return NextResponse.json({ today, backlog })
}

// POST /api/tg/tasks — быстрое добавление задачи
export async function POST(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'SCHEDULE', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { title, marina, clientId } = await req.json() as { title: string; marina?: string; clientId?: string }
  if (!title?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 422 })

  const task = await prisma.task.create({
    data: {
      companyId: session.companyId, title: title.trim(),
      marina: marina ?? '', clientId: clientId || null,
      isBacklog: true, status: 'NEW',
    },
    include: { client: { select: { id: true, firstName: true, lastName: true, marina: true } } },
  })

  await writeAudit({
    companyId: session.companyId, userId: session.id, action: 'CREATE',
    entity: 'Task', entityId: task.id, newValue: { title }, meta: { via: 'telegram_miniapp' },
  })

  return NextResponse.json(task, { status: 201 })
}
