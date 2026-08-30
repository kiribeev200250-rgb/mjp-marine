import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'

export interface InventoryValuation {
  costValue:       Decimal // сколько сейчас «заморожено» в остатках по закупочной цене — фактический капитал склада
  potentialValue:  Decimal // сколько можно выручить, продав весь остаток по текущей продажной цене
  potentialMargin: Decimal // potentialValue − costValue — потенциальная маржа склада, ещё не реализованная
}

// Живой расчёт по текущим qtyInStock × costPrice/sellPrice — не отдельная
// бухгалтерская запись (в отличие от FinanceEntry на приход/продажу): это
// снимок «сколько стоит то, что прямо сейчас лежит на складе», меняется
// автоматически с каждым движением, ничего сверх InventoryItem не хранит.
export async function computeInventoryValuation(companyId: string): Promise<InventoryValuation> {
  const items = await prisma.inventoryItem.findMany({
    where:  { companyId, active: true },
    select: { qtyInStock: true, costPrice: true, sellPrice: true },
  })

  let costValue      = new Decimal(0)
  let potentialValue = new Decimal(0)
  for (const it of items) {
    const qty = new Decimal(it.qtyInStock.toString())
    if (qty.lte(0)) continue
    costValue      = costValue.plus(qty.mul(it.costPrice.toString()))
    potentialValue = potentialValue.plus(qty.mul(it.sellPrice.toString()))
  }

  return { costValue, potentialValue, potentialMargin: potentialValue.minus(costValue) }
}
