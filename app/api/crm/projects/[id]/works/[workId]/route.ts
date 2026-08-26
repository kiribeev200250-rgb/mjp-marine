import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'
import { syncTaskFromProjectWorkStatus } from '@/lib/crm/services/projects'
import type { ProjectWorkStatus } from '@prisma/client'

const SETTABLE_STATUSES = new Set<ProjectWorkStatus>(['PLANNED', 'DONE'])

// PATCH /api/crm/projects/[id]/works/[workId] — сменить статус работы проекта
// напрямую (без календаря). MOVED_TO_INVOICE сюда не попадает — это
// терминальный статус, выставляется только каскадом переноса в счёт
// (moveProjectWorksToInvoice), нельзя ни поставить, ни снять отсюда. Если у
// работы есть связанная задача — синхронизируем её тоже (см.
// syncTaskFromProjectWorkStatus), чтобы отметка готовности не расходилась
// между проектом и календарём в зависимости от того, где её поставили.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; workId: string }> }) {
  const { id: projectId, workId } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { status: rawStatus } = body as { status?: string }
  if (!rawStatus || !SETTABLE_STATUSES.has(rawStatus as ProjectWorkStatus)) {
    return NextResponse.json({ error: 'Недопустимый статус' }, { status: 400 })
  }
  const status = rawStatus as ProjectWorkStatus

  const existing = await prisma.projectWork.findFirst({
    where: { id: workId, projectId, project: { companyId: session.user.companyId } },
  })
  if (!existing) return NextResponse.json({ error: 'Работа не найдена' }, { status: 404 })
  if (existing.status === 'MOVED_TO_INVOICE') {
    return NextResponse.json({ error: 'Работа уже перенесена в счёт — статус отсюда не меняется' }, { status: 400 })
  }

  try {
    const { updated, lowStockAlerts } = await prisma.$transaction(async (tx) => {
      const u = await tx.projectWork.update({ where: { id: workId }, data: { status } })
      const alerts = await syncTaskFromProjectWorkStatus(tx, session.user.companyId, existing, status)

      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId, userId: session.user.id,
          action: 'STATUS_CHANGE', entity: 'ProjectWork', entityId: workId,
          oldValue: { status: existing.status }, newValue: { status },
        },
      })

      return { updated: u, lowStockAlerts: alerts }
    })

    for (const a of lowStockAlerts) {
      void notifyAdmins(session.user.companyId, `⚠ Низкий остаток: «${a.name}» — ${a.newStock.toString()} ${a.unit} (мин. ${a.minAlert.toString()}).`)
    }

    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
