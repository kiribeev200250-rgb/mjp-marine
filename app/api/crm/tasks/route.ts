import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { TaskStatus } from '@prisma/client'

// GET /api/crm/tasks — все активные задачи + завершённые за последние 14 дней
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'VIEW')

  const { searchParams } = req.nextUrl
  const clientId = searchParams.get('clientId')
  const status   = searchParams.get('status') as TaskStatus | null

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      companyId: session.user.companyId,
      ...(clientId && { clientId }),
      ...(status   && { status }),
      OR: [
        { status: { notIn: ['DONE'] } },
        { completedAt: { gte: fourteenDaysAgo } },
      ],
    },
    orderBy: [
      { scheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      client: { select: { id: true, firstName: true, lastName: true, marina: true } },
      boat:   { select: { id: true, name: true, model: true } },
    },
  })

  return NextResponse.json(tasks)
}

// POST /api/crm/tasks — создать задачу
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'CREATE')

  const body = await req.json()
  const { title, description, clientId, boatId, marina, scheduledAt, startTime, endTime, isBacklog } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 422 })

  if (boatId) {
    if (!clientId) return NextResponse.json({ error: 'У задачи без клиента не может быть лодки' }, { status: 422 })
    const boat = await prisma.yacht.findFirst({ where: { id: boatId, clientId } })
    if (!boat) return NextResponse.json({ error: 'Лодка не найдена у этого клиента' }, { status: 404 })
  }

  const task = await prisma.task.create({
    data: {
      companyId:   session.user.companyId,
      title:       title.trim(),
      description: description ?? '',
      marina:      marina ?? '',
      clientId:    clientId || null,
      boatId:      boatId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      startTime:   startTime  ? new Date(startTime)   : null,
      endTime:     endTime    ? new Date(endTime)      : null,
      isBacklog:   isBacklog  ?? false,
      status:      scheduledAt ? 'SCHEDULED' : 'NEW',
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, marina: true } },
      boat:   { select: { id: true, name: true, model: true } },
    },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'CREATE',
    entity:    'Task',
    entityId:  task.id,
    newValue:  { title, scheduledAt },
  })

  return NextResponse.json(task, { status: 201 })
}
