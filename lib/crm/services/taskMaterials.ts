import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export interface TaskMaterial { itemId: string; name: string; unit: string; qty: string }
export interface LowStockAlert { name: string; newStock: Decimal; unit: string; minAlert: Decimal }

// Автосписание материалов задачи при переходе в DONE (SPEC М2) — вызывать
// ТОЛЬКО внутри той же транзакции, что и смену статуса, иначе задача может
// застрять в DONE без реального списания склада при сбое посередине.
// Общая для одиночного PATCH (app/api/crm/tasks/[id]/route.ts) и массового
// перехода статуса (app/api/crm/tasks/bulk/route.ts) — чтобы поведение не
// расходилось между "выполнить одну задачу" и "выполнить несколько разом".
export async function writeOffMaterials(
  tx: Tx,
  companyId: string,
  taskId: string,
  materials: TaskMaterial[],
): Promise<LowStockAlert[]> {
  if (materials.length === 0) return []

  const items = await tx.inventoryItem.findMany({
    where: { id: { in: materials.map((m) => m.itemId) }, companyId },
  })

  const lowStockAlerts: LowStockAlert[] = []

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
