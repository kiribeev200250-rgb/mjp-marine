import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'
import { taskScopeWhere } from '@/lib/crm/scope'
import type { TaskStatus } from '@prisma/client'

interface TaskMaterial { itemId: string; name: string; unit: string; qty: string }

// Списывает привязанные к задаче материалы со склада при переходе в DONE.
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

    const qty = new Decimal(m.qty || 0)
    const currentStock = new Decimal(item.qtyInStock.toString())
    const newStock = Decimal.max(0, currentStock.minus(qty))
    const unitPrice = new Decimal(item.costPrice.toString())
    const total = qty.mul(unitPrice)

    ops.push(
      prisma.stockMovement.create({
        data: { companyId, itemId: item.id, taskId, type: 'WRITE_OFF', qty, unitPrice, total, note: 'Автосписание при выполнении задачи (Telegram)' },
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

// PATCH /api/tg/tasks/[id] — смена статуса задачи из Mini App
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'SCHEDULE', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const existing = await prisma.task.findFirst({ where: { id, companyId: session.companyId, ...taskScopeWhere(session) } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const { status } = await req.json() as { status: TaskStatus }
  if (!status) return NextResponse.json({ error: 'Укажите статус' }, { status: 400 })

  const data: Record<string, unknown> = { status }
  if (status === 'DONE') data.completedAt = new Date()
  if (status !== 'DONE' && existing.completedAt) data.completedAt = null

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: { client: { select: { id: true, firstName: true, lastName: true, marina: true } } },
  })

  if (updated.status === 'DONE' && !updated.materialsWrittenOff) {
    const materials = Array.isArray(updated.plannedMaterials) ? (updated.plannedMaterials as unknown as TaskMaterial[]) : []
    if (materials.length > 0) await writeOffMaterials(session.companyId, id, materials)
  }

  await writeAudit({
    companyId: session.companyId, userId: session.id, action: 'STATUS_CHANGE',
    entity: 'Task', entityId: id,
    oldValue: { status: existing.status }, newValue: { status }, meta: { via: 'telegram_miniapp' },
  })

  return NextResponse.json(updated)
}
