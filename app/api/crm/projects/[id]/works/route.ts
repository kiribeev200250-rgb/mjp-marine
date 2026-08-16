import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { parseJobsInput, jobsToCreateInput, type JobInput } from '@/lib/crm/documentJobs'
import { createLinkedTask } from '@/lib/crm/services/projects'
import { prisma } from '@/lib/prisma'

// POST /api/crm/projects/[id]/works — добавить работу в проект (план — склад/
// деньги не трогает). Если задана дата — создаётся связанная задача в
// календаре (см. createLinkedTask): работа проекта видна и планируется через
// тот же планировщик, что и обычные задачи.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: session.user.companyId },
    include: { boat: true },
  })
  if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { scheduledAt, startTime, endTime, ...jobInput } = body as JobInput & {
    scheduledAt?: string | null
    startTime?: string | null
    endTime?: string | null
  }

  let parsedJob
  try {
    ;({ jobs: [parsedJob] } = parseJobsInput([jobInput]))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректные данные' }, { status: 400 })
  }

  const existingCount = await prisma.projectWork.count({ where: { projectId } })
  const [createInput] = jobsToCreateInput([parsedJob])

  try {
    const work = await prisma.$transaction(async (tx) => {
      const w = await tx.projectWork.create({
        data: { projectId, ...createInput, sortOrder: existingCount },
        include: { materials: true },
      })

      if (scheduledAt) {
        const taskId = await createLinkedTask(
          tx, session.user.companyId,
          { title: w.title, scheduledAt: new Date(scheduledAt), startTime: startTime ? new Date(startTime) : null, endTime: endTime ? new Date(endTime) : null },
          { id: project.boat.id, clientId: project.boat.clientId, marina: project.boat.marina },
        )
        await tx.projectWork.update({
          where: { id: w.id },
          data: { taskId, scheduledAt: new Date(scheduledAt), startTime: startTime ? new Date(startTime) : null, endTime: endTime ? new Date(endTime) : null },
        })
      }

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId, userId: session.user.id,
          action: 'CREATE', entity: 'ProjectWork', entityId: w.id,
          newValue: { title: w.title, laborCost: w.laborCost.toString(), projectId },
        },
      })

      return tx.projectWork.findUniqueOrThrow({ where: { id: w.id }, include: { materials: true, task: true } })
    })

    return NextResponse.json(work, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
