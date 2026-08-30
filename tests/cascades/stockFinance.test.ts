import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeInventoryItem } from '../helpers/fixtures'
import { recordStockFinanceEntry } from '@/lib/crm/services/stockFinance'

describe('recordStockFinanceEntry', () => {
  it('RECEIVE creates an EXPENSE entry for qty × unitPrice', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const item = await makeInventoryItem(tx, companyId, { qtyInStock: 0 })

      const result = await recordStockFinanceEntry(tx, companyId, item, 'RECEIVE', new Decimal(30))
      expect(result).not.toBeNull()

      const entry = await tx.financeEntry.findUnique({ where: { id: result!.id } })
      expect(entry!.type).toBe('EXPENSE')
      expect(new Decimal(entry!.amount.toString()).toString()).toBe('30')
      expect(entry!.category).toBe('Закупка склад')
      expect(entry!.categoryId).not.toBeNull()
      expect(entry!.description).toContain(item.name)
    })
  })

  it('SELL creates an INCOME entry for qty × unitPrice', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const item = await makeInventoryItem(tx, companyId, { qtyInStock: 10 })

      const result = await recordStockFinanceEntry(tx, companyId, item, 'SELL', new Decimal(60))
      expect(result).not.toBeNull()

      const entry = await tx.financeEntry.findUnique({ where: { id: result!.id } })
      expect(entry!.type).toBe('INCOME')
      expect(new Decimal(entry!.amount.toString()).toString()).toBe('60')
      expect(entry!.category).toBe('Продажа запчастей')
    })
  })

  it('does nothing when total is zero (free receive/sample)', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const item = await makeInventoryItem(tx, companyId, { qtyInStock: 0 })

      const result = await recordStockFinanceEntry(tx, companyId, item, 'RECEIVE', new Decimal(0))
      expect(result).toBeNull()

      const count = await tx.financeEntry.count({ where: { companyId } })
      expect(count).toBe(0)
    })
  })

  it('reuses the same category across repeated calls instead of duplicating it', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const item = await makeInventoryItem(tx, companyId, { qtyInStock: 0 })

      await recordStockFinanceEntry(tx, companyId, item, 'RECEIVE', new Decimal(10))
      await recordStockFinanceEntry(tx, companyId, item, 'RECEIVE', new Decimal(20))

      const categories = await tx.category.findMany({ where: { companyId, kind: 'EXPENSE', name: 'Закупка склад' } })
      expect(categories.length).toBe(1)

      const entries = await tx.financeEntry.findMany({ where: { companyId, type: 'EXPENSE' }, orderBy: { autoId: 'asc' } })
      expect(entries.length).toBe(2)
      expect(entries[0].autoId).not.toBe(entries[1].autoId)
    })
  })
})
