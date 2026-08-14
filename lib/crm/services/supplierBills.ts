import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import { findOrCreateCategory } from '@/lib/crm/services/categories'
import { recordVat } from '@/lib/crm/services/vat'
import { prisma } from '@/lib/prisma'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Кредиторка — сколько компания должна поставщикам прямо сейчас (аналог
// дебиторки, в обратную сторону): всё, что заказано или уже принято, но ещё
// не оплачено. total (брутто, с IVA) — та же сумма, что реально нужно
// перечислить поставщику.
export async function computeAccountsPayable(companyId: string): Promise<Decimal> {
  const agg = await prisma.supplierBill.aggregate({
    where: { companyId, status: { in: ['ORDERED', 'RECEIVED'] } },
    _sum: { total: true },
  })
  return new Decimal(agg._sum.total?.toString() ?? 0)
}

// Кредиторка (AP) — поток «заказано под задачу/клиента, ждём поставки →
// приёмка → оплата», обвязка вокруг УЖЕ существующих типов StockMovement
// (ORDER/RECEIVE, см. InventoryTable/MovementModal) со статусом на самом
// SupplierBill — не отдельный параллельный склад-поток.

// Приёмка: ORDERED → RECEIVED. Если счёт привязан к позиции склада — создаёт
// RECEIVE (тот же тип, что и ручной приход в InventoryTable), увеличивает
// qtyInStock, уменьшает qtyOrdered. Идемпотентно — повторный вызов на уже
// принятом счёте ничего не делает.
export async function receiveSupplierBill(tx: Tx, companyId: string, billId: string): Promise<string[]> {
  const bill = await tx.supplierBill.findFirst({ where: { id: billId, companyId }, include: { item: true, supplier: true } })
  if (!bill) throw new Error('Заказ не найден')
  if (bill.status !== 'ORDERED') return []

  const lines: string[] = []

  if (bill.item) {
    const qty = new Decimal(bill.qty.toString())
    const currentStock   = new Decimal(bill.item.qtyInStock.toString())
    const currentOrdered = new Decimal(bill.item.qtyOrdered.toString())
    const newStock   = currentStock.plus(qty)
    const newOrdered = Decimal.max(0, currentOrdered.minus(qty))

    await tx.stockMovement.create({
      data: {
        companyId, itemId: bill.item.id, type: 'RECEIVE', qty,
        unitPrice: bill.amount.toString() === '0' ? bill.item.costPrice : new Decimal(bill.amount.toString()).div(qty),
        total: bill.amount,
        note: `Приёмка от поставщика ${bill.supplier.name} (заказ ${bill.id})`,
      },
    })
    await tx.inventoryItem.update({ where: { id: bill.item.id }, data: { qtyInStock: newStock, qtyOrdered: newOrdered } })
    lines.push(`${bill.item.name} ×${qty.toString()} ${bill.item.unit} принято на склад`)
  }

  await tx.supplierBill.update({ where: { id: billId }, data: { status: 'RECEIVED', receivedAt: new Date() } })
  lines.push(`Заказ у поставщика «${bill.supplier.name}» переведён в «Принято»`)
  return lines
}

// Оплата поставщику — обычный расход (EXPENSE), тот же каскад/учёт, что и
// любая другая трата: нетто в P&L, IVA (если есть) — в soportado отдельно.
// Идемпотентно — повторный вызов на уже оплаченном счёте ничего не делает.
export async function paySupplierBill(
  tx: Tx, companyId: string, billId: string, paymentMethod?: string,
): Promise<string[]> {
  const bill = await tx.supplierBill.findFirst({ where: { id: billId, companyId }, include: { supplier: true } })
  if (!bill) throw new Error('Заказ не найден')
  if (bill.status === 'PAID') return []
  if (bill.status === 'CANCELLED') throw new Error('Заказ отменён — оплата невозможна')

  const now = new Date()
  const autoId = await nextFinanceAutoId(tx, companyId, 'EXPENSE', now.getFullYear())
  const category = await findOrCreateCategory(tx, companyId, 'EXPENSE', 'Закупка у поставщика')
  const amount = new Decimal(bill.amount.toString())
  const vatAmount = new Decimal(bill.vatAmount.toString())
  const vatRate = new Decimal(bill.vatRate.toString())

  const entry = await tx.financeEntry.create({
    data: {
      companyId, autoId, type: 'EXPENSE', date: now,
      category: category.name, categoryId: category.id,
      amountExpr: amount.toString(), amount,
      hasVat: bill.hasVat, vatRate, vatAmount,
      paymentMethod: paymentMethod ?? '',
      description: `${bill.description} — ${bill.supplier.name}`,
      clientId: bill.clientId,
    },
  })

  if (bill.hasVat && vatAmount.gt(0)) {
    await recordVat(tx, companyId, {
      direction: 'SOPORTADO', date: now, baseAmount: amount, rate: vatRate, amount: vatAmount,
      financeEntryId: entry.id, note: `Оплата поставщику ${bill.supplier.name}`,
    })
  }

  await tx.supplierBill.update({
    where: { id: billId },
    data: { status: 'PAID', paidAt: now, financeEntryId: entry.id },
  })

  return [
    `Расход −${amount.toFixed(2)} € (${autoId}) — оплата поставщику «${bill.supplier.name}»`,
    `Заказ снят с кредиторки`,
  ]
}
