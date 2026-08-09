import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'
import type { TaskStatus } from '@prisma/client'

interface TaskMaterial { itemId: string; name: string; unit: string; qty: string }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'VIEW')

  const task = await prisma.task.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      stockUsage: { include: { item: { select: { id: true, name: true, unit: true } } } },
    },
  })

  if (!task) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  return NextResponse.json(task)
}

// Списывает привязанные к задаче материалы со склада (StockMovement WRITE_OFF)
// и шлёт алерт в Telegram, если остаток после списания ушёл ниже минимума.
async function writeOffMaterials(companyId: string, taskId: string, materials: TaskMaterial[]) {
  if (materials.length === 0) return

  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: materials.map((m) => m.itemId) }, companyId },
  })

  const lowStockAlerts: { name: string; newStock: Decimal; unit: string; minAlert: Decimal }[] = []

  const ops = []
  for (const m of materials) {
    const item = items.find((i) => i.id === m.itemId)
    if (!item) continue

    const qty          = new Decimal(m.qty || 0)
    const currentStock = new Decimal(item.qtyInStock.toString())
    const newStock      = Decimal.max(0, currentStock.minus(qty))
    const unitPrice      = new Decimal(item.costPrice.toString())
    const total           = qty.mul(unitPrice)

    ops.push(
      prisma.stockMovement.create({
        data: {
          companyId, itemId: item.id, taskId, type: 'WRITE_OFF',
          qty, unitPrice, total, note: 'Автосписание при выполнении задачи',
        },
      }),
      prisma.inventoryItem.update({ where: { id: item.id }, data: { qtyInStock: newStock } }),
    )

    const minAlert = new Decimal(item.qtyMinAlert.toString())
    if (minAlert.gt(0) && newStock.lt(minAlert)) {
      lowStockAlerts.push({ name: item.name, newStock, unit: item.unit, minAlert })
    }
  }

  ops.push(prisma.task.update({ where: { id: taskId }, data: { materialsWrittenOff: true } }))

  await prisma.$transaction(ops)

  for (const a of lowStockAlerts) {
    void notifyAdmins(companyId, `⚠ Низкий остаток: «${a.name}» — ${a.newStock.toString()} ${a.unit} (мин. ${a.minAlert.toString()}).`)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'EDIT')

  const existing = await prisma.task.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const {
    status, scheduledAt, startTime, endTime, title, description, marina, clientId, isBacklog,
    plannedMaterials, photosBefore, photosAfter,
  } = body

  const data: Record<string, unknown> = {}
  if (title       !== undefined) data.title       = title
  if (description !== undefined) data.description = description
  if (marina      !== undefined) data.marina      = marina
  if (clientId    !== undefined) data.clientId    = clientId || null
  if (isBacklog   !== undefined) data.isBacklog   = isBacklog
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

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: { client: { select: { id: true, firstName: true, lastName: true, marina: true } } },
  })

  // Автосписание материалов при переходе в DONE (SPEC М2)
  if (updated.status === 'DONE' && !updated.materialsWrittenOff) {
    const materials = Array.isArray(updated.plannedMaterials) ? (updated.plannedMaterials as unknown as TaskMaterial[]) : []
    if (materials.length > 0) {
      await writeOffMaterials(session.user.companyId, id, materials)
    }
  }

  if (status && status !== existing.status) {
    await writeAudit({
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'STATUS_CHANGE',
      entity:    'Task',
      entityId:  id,
      oldValue:  { status: existing.status },
      newValue:  { status },
    })
  } else {
    await writeAudit({
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'UPDATE',
      entity:    'Task',
      entityId:  id,
      newValue:  data,
    })
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
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'DELETE')

  const existing = await prisma.task.findFirst({
    where: { id, companyId: session.user.companyId },
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
