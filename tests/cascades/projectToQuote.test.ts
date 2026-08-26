import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeBoat, makeProject, makeProjectWork, makeUser, makeInventoryItem } from '../helpers/fixtures'
import { moveProjectWorksToQuote } from '@/lib/crm/services/projects'

describe('moveProjectWorksToQuote', () => {
  it('creates a quote from selected works and leaves them PLANNED in the project (linked via quoteId)', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21, legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)

      const workA = await makeProjectWork(tx, project.id, {
        laborCost: 100,
        materials: [{ name: 'Impeller', quantity: 2, unitPrice: 15 }],
      })
      const workB = await makeProjectWork(tx, project.id, { laborCost: 999 }) // not selected

      const { quote } = await moveProjectWorksToQuote(tx, companyId, user.id, project.id, [workA.id], { ivaRate: 21 })

      expect(new Decimal(quote.jobsTotal.toString()).toString()).toBe('100')
      expect(new Decimal(quote.materialsTotal.toString()).toString()).toBe('30')
      expect(new Decimal(quote.subtotal.toString()).toString()).toBe('130')
      expect(new Decimal(quote.ivaAmount.toString()).toString()).toBe('27.3')
      expect(new Decimal(quote.total.toString()).toString()).toBe('157.3')

      const updatedA = await tx.projectWork.findUnique({ where: { id: workA.id } })
      const updatedB = await tx.projectWork.findUnique({ where: { id: workB.id } })
      expect(updatedA!.status).toBe('PLANNED')   // stays in the project, unlike invoice transfer
      expect(updatedA!.quoteId).toBe(quote.id)
      expect(updatedB!.quoteId).toBeNull()       // untouched
    })
  })

  it('does not touch stock — a material with an inventory link is not written off', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 10, costPrice: 15 })
      const work      = await makeProjectWork(tx, project.id, {
        laborCost: 50,
        materials: [{ name: 'Impeller', quantity: 2, unitPrice: 15, inventoryItemId: item.id }],
      })

      await moveProjectWorksToQuote(tx, companyId, user.id, project.id, [work.id], {})

      // Scoped to this test's own throwaway item/company — not an unscoped
      // count of the whole table, which would pick up unrelated real data.
      const movements = await tx.stockMovement.findMany({ where: { itemId: item.id } })
      expect(movements.length).toBe(0)

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('10')
    })
  })

  it('can re-quote the same work — quoteId moves to the newer quote', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50 })

      const first  = await moveProjectWorksToQuote(tx, companyId, user.id, project.id, [work.id], {})
      const second = await moveProjectWorksToQuote(tx, companyId, user.id, project.id, [work.id], {})

      expect(first.quote.id).not.toBe(second.quote.id)
      const updated = await tx.projectWork.findUnique({ where: { id: work.id } })
      expect(updated!.status).toBe('PLANNED')
      expect(updated!.quoteId).toBe(second.quote.id)
    })
  })

  it('a work already MOVED_TO_INVOICE cannot be quoted', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50, status: 'MOVED_TO_INVOICE' })

      await expect(
        moveProjectWorksToQuote(tx, companyId, user.id, project.id, [work.id], {}),
      ).rejects.toThrow()
    })
  })

  it('a DONE work is quotable too', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { legalName: 'Test SL' })
      const user      = await makeUser(tx, companyId)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50, status: 'DONE' })

      const { quote } = await moveProjectWorksToQuote(tx, companyId, user.id, project.id, [work.id], {})
      expect(quote.total).toBeDefined()

      const updated = await tx.projectWork.findUnique({ where: { id: work.id } })
      expect(updated!.status).toBe('DONE') // quote never changes the work's status
      expect(updated!.quoteId).toBe(quote.id)
    })
  })
})
