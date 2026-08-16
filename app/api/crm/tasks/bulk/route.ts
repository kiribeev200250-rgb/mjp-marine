import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'
import { taskScopeWhere } from '@/lib/crm/scope'
import { writeOffMaterials, type TaskMaterial, type LowStockAlert } from '@/lib/crm/services/taskMaterials'
import type { TaskStatus } from '@prisma/client'

const MAX_IDS = 100

// PATCH /api/crm/tasks/bulk — массовая правка (перенос на дату, смена
// статуса) для списка задач разом, вместо правки по одной. Каждый выбранный
// id проверяется на company + scope (OWN_TASKS/OWN_MARINA), несуществующие
// или недоступные по scope id молча пропускаются (не 404 на всю пачку) —
// отчёт какие id реально применились уходит в ответе. Один $transaction на
// весь батч — либо применилось всё, либо ничего; тот же переход в DONE
// внутри батча запускает автосписание материалов (writeOffMaterials), что и
// одиночный PATCH — поведение не должно расходиться в зависимости от того,
// одну задачу выполнили или пять разом.
export async function PATCH(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SCHEDULE', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { ids, patch } = body as {
    ids?: string[]
    patch?: { scheduledAt?: string | null; isBacklog?: boolean; status?: TaskStatus }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Не выбрано ни одной задачи' }, { status: 400 })
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Слишком много задач за раз (максимум ${MAX_IDS})` }, { status: 400 })
  }
  if (!patch || (patch.scheduledAt === undefined && patch.isBacklog === undefined && patch.status === undefined)) {
    return NextResponse.json({ error: 'Нечего применять' }, { status: 400 })
  }

  const found = await prisma.task.findMany({
    where: { id: { in: ids }, companyId: session.user.companyId, ...taskScopeWhere(session.user) },
  })
  const skippedIds = ids.filter((id) => !found.some((t) => t.id === id))

  try {
    const { updatedIds, lowStockAlerts } = await prisma.$transaction(async (tx) => {
      const updatedIds: string[] = []
      const lowStockAlerts: LowStockAlert[] = []

      for (const existing of found) {
        const data: Record<string, unknown> = { version: { increment: 1 } }

        if (patch.status !== undefined) {
          data.status = patch.status
          if (patch.status === 'DONE') data.completedAt = new Date()
          if (patch.status !== 'DONE' && existing.completedAt) data.completedAt = null
        }
        if (patch.scheduledAt !== undefined) {
          data.scheduledAt = patch.scheduledAt ? new Date(patch.scheduledAt) : null
          if (patch.scheduledAt && existing.status === 'NEW' && patch.status === undefined) data.status = 'SCHEDULED'
        }
        if (patch.isBacklog !== undefined) data.isBacklog = patch.isBacklog

        const updated = await tx.task.update({ where: { id: existing.id }, data })
        updatedIds.push(updated.id)

        if (updated.status === 'DONE' && !updated.materialsWrittenOff) {
          const materials = Array.isArray(updated.plannedMaterials) ? (updated.plannedMaterials as unknown as TaskMaterial[]) : []
          if (materials.length > 0) {
            const alerts = await writeOffMaterials(tx, session.user.companyId, updated.id, materials)
            lowStockAlerts.push(...alerts)
          }
        }

        await tx.auditLog.create({
          data: {
            companyId: session.user.companyId,
            userId:    session.user.id,
            action:    patch.status !== undefined ? 'STATUS_CHANGE' : 'UPDATE',
            entity:    'Task',
            entityId:  existing.id,
            oldValue:  { status: existing.status, scheduledAt: existing.scheduledAt, isBacklog: existing.isBacklog },
            newValue:  data as object,
            meta:      { bulk: true, batchSize: found.length },
          },
        })
      }

      return { updatedIds, lowStockAlerts }
    })

    for (const a of lowStockAlerts) {
      void notifyAdmins(session.user.companyId, `⚠ Низкий остаток: «${a.name}» — ${a.newStock.toString()} ${a.unit} (мин. ${a.minAlert.toString()}).`)
    }

    return NextResponse.json({ ok: true, updatedIds, skippedIds })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
