import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeInventoryItem, makeSupplier, makeSupplierBill } from '../helpers/fixtures'
import { receiveSupplierBill, paySupplierBill } from '@/lib/crm/services/supplierBills'

describe('receiveSupplierBill', () => {
  it('receiving an item-linked bill moves qty from ordered to in-stock and logs a RECEIVE movement', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const supplier   = await makeSupplier(tx, companyId)
      const item       = await makeInventoryItem(tx, companyId, { qtyInStock: 2, qtyOrdered: 5, costPrice: 10 })
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { itemId: item.id, qty: 5, amount: 50 })

      const lines = await receiveSupplierBill(tx, companyId, bill.id)
      expect(lines.length).toBeGreaterThan(0)

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('7')
      expect(new Decimal(updatedItem!.qtyOrdered.toString()).toString()).toBe('0')

      const movement = await tx.stockMovement.findFirst({ where: { itemId: item.id, type: 'RECEIVE' } })
      expect(movement).not.toBeNull()
      expect(new Decimal(movement!.qty.toString()).toString()).toBe('5')

      const updatedBill = await tx.supplierBill.findUnique({ where: { id: bill.id } })
      expect(updatedBill!.status).toBe('RECEIVED')
      expect(updatedBill!.receivedAt).not.toBeNull()
    })
  })

  it('never lets qtyOrdered go negative when ordered qty is less than the item qty already on the bill', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const supplier   = await makeSupplier(tx, companyId)
      const item       = await makeInventoryItem(tx, companyId, { qtyInStock: 0, qtyOrdered: 2, costPrice: 10 })
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { itemId: item.id, qty: 5, amount: 50 })

      await receiveSupplierBill(tx, companyId, bill.id)

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyOrdered.toString()).toString()).toBe('0')
    })
  })

  it('is idempotent — receiving an already-RECEIVED bill does nothing', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const supplier   = await makeSupplier(tx, companyId)
      const item       = await makeInventoryItem(tx, companyId, { qtyInStock: 7, qtyOrdered: 0, costPrice: 10 })
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { itemId: item.id, qty: 5, amount: 50, status: 'RECEIVED' })

      const lines = await receiveSupplierBill(tx, companyId, bill.id)
      expect(lines).toEqual([])

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('7')
    })
  })

  it('a bill with no linked item just flips status, without touching stock', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const supplier   = await makeSupplier(tx, companyId)
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { amount: 200 })

      const lines = await receiveSupplierBill(tx, companyId, bill.id)
      expect(lines.length).toBe(1)

      const updatedBill = await tx.supplierBill.findUnique({ where: { id: bill.id } })
      expect(updatedBill!.status).toBe('RECEIVED')
    })
  })
})

describe('paySupplierBill', () => {
  it('creates a net EXPENSE finance entry and a SOPORTADO vat entry, then marks the bill PAID', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const supplier   = await makeSupplier(tx, companyId)
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { amount: 100, hasVat: true, vatRate: 21, status: 'RECEIVED' })

      const lines = await paySupplierBill(tx, companyId, bill.id)
      expect(lines.length).toBeGreaterThan(0)

      const entry = await tx.financeEntry.findFirst({ where: { companyId, type: 'EXPENSE', description: { contains: supplier.name } } })
      expect(entry).not.toBeNull()
      expect(new Decimal(entry!.amount.toString()).toString()).toBe('100')

      const vat = await tx.vatEntry.findFirst({ where: { financeEntryId: entry!.id } })
      expect(vat).not.toBeNull()
      expect(vat!.direction).toBe('SOPORTADO')
      expect(new Decimal(vat!.amount.toString()).toString()).toBe('21')

      const updatedBill = await tx.supplierBill.findUnique({ where: { id: bill.id } })
      expect(updatedBill!.status).toBe('PAID')
      expect(updatedBill!.financeEntryId).toBe(entry!.id)
    })
  })

  it('is idempotent — paying an already-PAID bill does nothing and creates no extra expense', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const supplier   = await makeSupplier(tx, companyId)
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { amount: 100, status: 'PAID' })

      const lines = await paySupplierBill(tx, companyId, bill.id)
      expect(lines).toEqual([])

      const count = await tx.financeEntry.count({ where: { companyId, type: 'EXPENSE' } })
      expect(count).toBe(0)
    })
  })

  it('rejects paying a cancelled bill', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const supplier   = await makeSupplier(tx, companyId)
      const bill       = await makeSupplierBill(tx, companyId, supplier.id, { amount: 100, status: 'CANCELLED' })

      await expect(paySupplierBill(tx, companyId, bill.id)).rejects.toThrow()
    })
  })
})
