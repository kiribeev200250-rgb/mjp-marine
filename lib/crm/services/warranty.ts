import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'

export interface WarrantyStats {
  taskCount:           number
  taskHours:           Decimal // Σ(endTime − startTime) по завершённым гарантийным задачам
  taskMaterialCost:    Decimal // Σ StockMovement.total (WRITE_OFF) по гарантийным задачам — реальная себестоимость по цене склада
  invoiceCount:        number
  invoiceMaterialCost: Decimal // Σ себестоимость материалов по гарантийным счетам (та же формула, что profitability.ts)
}

// Метрика качества: сколько времени/денег ушло на гарантию/переделки за
// период — задачи считаются по дате завершения, счета по дате выставления.
// Себестоимость труда не считается отдельной суммой — в системе нет ставки
// часа техника; taskHours — прокси по факту (для перевода в деньги владелец
// сам умножает на свою оценку часовой ставки).
export async function computeWarrantyStats(companyId: string, from: Date, to: Date): Promise<WarrantyStats> {
  const tasks = await prisma.task.findMany({
    where: { companyId, isWarranty: true, completedAt: { gte: from, lt: to } },
    include: { stockUsage: { where: { type: 'WRITE_OFF' } } },
  })

  let taskHours = new Decimal(0)
  let taskMaterialCost = new Decimal(0)
  for (const t of tasks) {
    if (t.startTime && t.endTime) {
      taskHours = taskHours.plus((t.endTime.getTime() - t.startTime.getTime()) / 3_600_000)
    }
    for (const mv of t.stockUsage) {
      taskMaterialCost = taskMaterialCost.plus(mv.total.toString())
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId, isWarranty: true, date: { gte: from, lt: to },
      status: { in: ['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE'] },
    },
    select: {
      jobs: {
        select: {
          materials: { select: { quantity: true, inventoryItem: { select: { costPrice: true } } } },
        },
      },
    },
  })

  let invoiceMaterialCost = new Decimal(0)
  for (const inv of invoices) {
    for (const job of inv.jobs) {
      for (const m of job.materials) {
        if (!m.inventoryItem) continue
        invoiceMaterialCost = invoiceMaterialCost.plus(new Decimal(m.quantity.toString()).times(m.inventoryItem.costPrice.toString()))
      }
    }
  }

  return {
    taskCount: tasks.length,
    taskHours,
    taskMaterialCost,
    invoiceCount: invoices.length,
    invoiceMaterialCost,
  }
}
