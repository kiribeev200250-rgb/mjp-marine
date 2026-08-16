import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeBoat, makeProject, makeProjectWork, makeInventoryItem, makeUser } from '../helpers/fixtures'
import { moveProjectWorksToInvoice } from '@/lib/crm/services/projects'

describe('moveProjectWorksToInvoice', () => {
  it('moves selected PLANNED works into a new invoice, writes off stock, leaves unselected work in the project', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21, legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 10, costPrice: 15 })

      const workA = await makeProjectWork(tx, project.id, {
        laborCost: 100,
        materials: [{ name: 'Impeller', quantity: 2, unitPrice: 15, inventoryItemId: item.id }],
      })
      const workB = await makeProjectWork(tx, project.id, { laborCost: 50 })
      const workC = await makeProjectWork(tx, project.id, { laborCost: 999 }) // stays behind

      const { invoice, cascade } = await moveProjectWorksToInvoice(
        tx, companyId, user.id, project.id, [workA.id, workB.id], { ivaRate: 21 },
      )

      expect(new Decimal(invoice.jobsTotal.toString()).toString()).toBe('150')
      expect(new Decimal(invoice.materialsTotal.toString()).toString()).toBe('30')
      expect(new Decimal(invoice.subtotal.toString()).toString()).toBe('180')
      expect(new Decimal(invoice.ivaAmount.toString()).toString()).toBe('37.8')
      expect(new Decimal(invoice.total.toString()).toString()).toBe('217.8')
      expect(invoice.status).toBe('ISSUED')
      expect(cascade.length).toBeGreaterThan(0)

      const updatedA = await tx.projectWork.findUnique({ where: { id: workA.id } })
      const updatedB = await tx.projectWork.findUnique({ where: { id: workB.id } })
      const updatedC = await tx.projectWork.findUnique({ where: { id: workC.id } })
      expect(updatedA!.status).toBe('MOVED_TO_INVOICE')
      expect(updatedA!.invoiceId).toBe(invoice.id)
      expect(updatedB!.status).toBe('MOVED_TO_INVOICE')
      expect(updatedC!.status).toBe('PLANNED') // untouched — stays in the project

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('8')

      const movement = await tx.stockMovement.findFirst({ where: { itemId: item.id, type: 'WRITE_OFF' } })
      expect(movement).not.toBeNull()
      expect(new Decimal(movement!.qty.toString()).toString()).toBe('2')
    })
  })

  it('is not double-transferable — a work already MOVED_TO_INVOICE is not picked up again', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const work      = await makeProjectWork(tx, project.id, { laborCost: 100, status: 'MOVED_TO_INVOICE' })

      await expect(
        moveProjectWorksToInvoice(tx, companyId, user.id, project.id, [work.id], {}),
      ).rejects.toThrow()
    })
  })

  it('rejects when company fiscal info is not filled in', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx) // no legalName override — keeps the placeholder
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const work      = await makeProjectWork(tx, project.id, { laborCost: 100 })

      await expect(
        moveProjectWorksToInvoice(tx, companyId, user.id, project.id, [work.id], {}),
      ).rejects.toThrow()
    })
  })
})
