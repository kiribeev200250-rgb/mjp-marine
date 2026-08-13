import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeInvoice, makeInventoryItem } from '../helpers/fixtures'
import { writeOffInvoiceMaterials, returnInvoiceMaterials } from '@/lib/crm/services/invoiceCascade'

describe('writeOffInvoiceMaterials', () => {
  it('deducts stock and creates a WRITE_OFF movement, flags the invoice as written off', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 30 })
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 5, costPrice: 10 })

      const lines = await writeOffInvoiceMaterials(tx, companyId, invoice, [
        { materials: [{ name: item.name, quantity: 3, inventoryItemId: item.id }] },
      ])
      expect(lines.length).toBe(1)

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('2')

      const movement = await tx.stockMovement.findFirst({ where: { invoiceId: invoice.id, type: 'WRITE_OFF' } })
      expect(movement).not.toBeNull()
      expect(new Decimal(movement!.qty.toString()).toString()).toBe('3')

      const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updatedInvoice!.materialsWrittenOff).toBe(true)
    })
  })

  it('allows stock to go negative (does not block on shortage) and says so in the summary line', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 30 })
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 5, costPrice: 10 })

      const lines = await writeOffInvoiceMaterials(tx, companyId, invoice, [
        { materials: [{ name: item.name, quantity: 8, inventoryItemId: item.id }] },
      ])

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('-3')
      expect(lines[0]).toMatch(/минус/)
    })
  })

  it('is idempotent — a second call on an already-written-off invoice does nothing', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 30 })
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 5, costPrice: 10 })
      const jobs = [{ materials: [{ name: item.name, quantity: 3, inventoryItemId: item.id }] }]

      await writeOffInvoiceMaterials(tx, companyId, invoice, jobs)
      const secondCallLines = await writeOffInvoiceMaterials(tx, companyId, invoice, jobs)
      expect(secondCallLines).toEqual([])

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      // Не списалось дважды — осталось 2, не -1
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('2')
    })
  })

  it('skips materials with no linked inventory item (manually-entered lines)', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 30 })

      const lines = await writeOffInvoiceMaterials(tx, companyId, invoice, [
        { materials: [{ name: 'Manual line', quantity: 3, inventoryItemId: null }] },
      ])
      expect(lines).toEqual([])
    })
  })
})

describe('returnInvoiceMaterials', () => {
  it('restores stock and resets the written-off flag on cancellation', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 30 })
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 5, costPrice: 10 })

      await writeOffInvoiceMaterials(tx, companyId, invoice, [
        { materials: [{ name: item.name, quantity: 3, inventoryItemId: item.id }] },
      ])
      const lines = await returnInvoiceMaterials(tx, companyId, invoice)
      expect(lines.length).toBe(1)

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('5')

      const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updatedInvoice!.materialsWrittenOff).toBe(false)

      const receiveMovement = await tx.stockMovement.findFirst({ where: { invoiceId: invoice.id, type: 'RECEIVE' } })
      expect(receiveMovement).not.toBeNull()
    })
  })

  it('is a no-op on an invoice whose materials were never written off', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 30 })

      const lines = await returnInvoiceMaterials(tx, companyId, invoice)
      expect(lines).toEqual([])
    })
  })
})
