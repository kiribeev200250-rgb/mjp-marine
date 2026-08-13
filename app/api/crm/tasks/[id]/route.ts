import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'
import { taskScopeWhere } from '@/lib/crm/scope'
import { checkVersion } from '@/lib/crm/optimisticLock'
import type { PrismaClient, TaskStatus } from '@prisma/client'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface TaskMaterial { itemId: string; name: string; unit: string; qty: string }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SCHEDULE', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const task = await prisma.task.findFirst({
    where: { id, companyId: session.user.companyId, ...taskScopeWhere(session.user) },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      boat:   { select: { id: true, name: true, model: true } },
      stockUsage: { include: { item: { select: { id: true, name: true, unit: true } } } },
    },
  })

  if (!task) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  return NextResponse.json(task)
}

// Списывает привязанные к задаче материалы со склада (StockMovement WRITE_OFF).
// Принимает tx — вызывается ВНУТРИ одной транзакции со сменой статуса задачи
// (см. PATCH ниже), иначе при сбое между «задача → DONE» и «материалы списаны»
// можно было получить задачу в DONE без реального списания склада. Алерты о
// низком остатке возвращаются вызывающей стороне — уведомление в Telegram
// шлётся уже ПОСЛЕ успешного коммита транзакции, не раньше.
async function writeOffMaterials(
  tx: Tx,
  companyId: string,
  taskId: string,
  materials: TaskMaterial[],
): Promise<{ name: string; newStock: Decimal; unit: string; minAlert: Decimal }[]> {
  if (materials.length === 0) return []

  const items = await tx.inventoryItem.findMany({
    where: { id: { in: materials.map((m) => m.itemId) }, companyId },
  })

  const lowStockAlerts: { name: string; newStock: Decimal; unit: string; minAlert: Decimal }[] = []

  for (const m of materials) {
    const item = items.find((i) => i.id === m.itemId)
    if (!item) continue

    const qty          = new Decimal(m.qty || 0)
    const currentStock = new Decimal(item.qtyInStock.toString())
    const newStock      = Decimal.max(0, currentStock.minus(qty))
    const unitPrice      = new Decimal(item.costPrice.toString())
    const total           = qty.mul(unitPrice)

    await tx.stockMovement.create({
      data: {
        companyId, itemId: item.id, taskId, type: 'WRITE_OFF',
        qty, unitPrice, total, note: 'Автосписание при выполнении задачи',
      },
    })
    await tx.inventoryItem.update({ where: { id: item.id }, data: { qtyInStock: newStock } })

    const minAlert = new Decimal(item.qtyMinAlert.toString())
    if (minAlert.gt(0) && newStock.lt(minAlert)) {
      lowStockAlerts.push({ name: item.name, newStock, unit: item.unit, minAlert })
    }
  }

  await tx.task.update({ where: { id: taskId }, data: { materialsWrittenOff: true } })

  return lowStockAlerts
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SCHEDULE', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const existing = await prisma.task.findFirst({
    where: { id, companyId: session.user.companyId, ...taskScopeWhere(session.user) },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const {
    status, scheduledAt, startTime, endTime, title, description, marina, clientId, boatId, isBacklog,
    plannedMaterials, photosBefore, photosAfter, version,
  } = body

  const conflict = checkVersion(version, existing.version)
  if (conflict) return conflict

  const data: Record<string, unknown> = {}
  if (title       !== undefined) data.title       = title
  if (description !== undefined) data.description = description
  if (marina      !== undefined) data.marina      = marina
  if (clientId    !== undefined) data.clientId    = clientId || null
  if (isBacklog   !== undefined) data.isBacklog   = isBacklog

  if (boatId !== undefined) {
    if (boatId) {
      const effectiveClientId = clientId !== undefined ? (clientId || null) : existing.clientId
      if (!effectiveClientId) return NextResponse.json({ error: 'У задачи без клиента не может быть лодки' }, { status: 422 })
      const boat = await prisma.yacht.findFirst({ where: { id: boatId, clientId: effectiveClientId } })
      if (!boat) return NextResponse.json({ error: 'Лодка не найдена у этого клиента' }, { status: 404 })
    }
    data.boatId = boatId || null
  }
  if (status      !== undefined) {
    data.status = status as TaskStatus
    if (status === 'DONE')  data.completedAt = new Date()
    if (status !== 'DONE' && existing.completedAt) data.completedAt = null
  }
  if (scheduledAt !== undefined) {
    data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null
    // Автоматически ставим статус SCHEDULED при назначении даты
    if (scheduledAt && existing.status === 'NEW') data.status = 'SCHEDULED'
  }
  if (startTime !== undefined) data.startTime = startTime ? new Date(startTime) : null
  if (endTime   !== undefined) data.endTime   = endTime   ? new Date(endTime)   : null

  // Материалы редактируемы только пока не списаны — после автосписания список заморожен
  if (plannedMaterials !== undefined && !existing.materialsWrittenOff) {
    data.plannedMaterials = plannedMaterials
  }
  if (photosBefore !== undefined) data.photosBefore = photosBefore
  if (photosAfter  !== undefined) data.photosAfter  = photosAfter
  data.version = { increment: 1 }

  let updated
  let lowStockAlerts: { name: string; newStock: Decimal; unit: string; minAlert: Decimal }[] = []
  try {
    updated = await prisma.$transaction(async (tx) => {
      const u = await tx.task.update({
        where: { id },
        data,
        include: {
          client: { select: { id: true, firstName: true, lastName: true, marina: true } },
          boat:   { select: { id: true, name: true, model: true } },
        },
      })

      // Автосписание материалов при переходе в DONE (SPEC М2) — в той же
      // транзакции, что и смена статуса, чтобы не застрять в DONE без
      // реального списания склада при сбое посередине.
      if (u.status === 'DONE' && !u.materialsWrittenOff) {
        const materials = Array.isArray(u.plannedMaterials) ? (u.plannedMaterials as unknown as TaskMaterial[]) : []
        if (materials.length > 0) {
          lowStockAlerts = await writeOffMaterials(tx, session.user.companyId, id, materials)
        }
      }

      if (status && status !== existing.status) {
        await tx.auditLog.create({
          data: {
            companyId: session.user.companyId,
            userId:    session.user.id,
            action:    'STATUS_CHANGE',
            entity:    'Task',
            entityId:  id,
            oldValue:  { status: existing.status },
            newValue:  { status },
          },
        })
      } else {
        await tx.auditLog.create({
          data: {
            companyId: session.user.companyId,
            userId:    session.user.id,
            action:    'UPDATE',
            entity:    'Task',
            entityId:  id,
            newValue:  data as object,
          },
        })
      }

      return u
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Операция не выполнена — ничего не изменилось' }, { status: 400 })
  }

  // Уведомления — только после успешного коммита транзакции.
  for (const a of lowStockAlerts) {
    void notifyAdmins(session.user.companyId, `⚠ Низкий остаток: «${a.name}» — ${a.newStock.toString()} ${a.unit} (мин. ${a.minAlert.toString()}).`)
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SCHEDULE', 'DELETE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const existing = await prisma.task.findFirst({
    where: { id, companyId: session.user.companyId, ...taskScopeWhere(session.user) },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.task.delete({ where: { id } })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'DELETE',
    entity:    'Task',
    entityId:  id,
    oldValue:  { title: existing.title },
  })

  return NextResponse.json({ ok: true })
}
