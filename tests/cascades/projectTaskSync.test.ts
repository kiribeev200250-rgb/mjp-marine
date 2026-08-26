import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeBoat, makeProject, makeProjectWork, makeInventoryItem } from '../helpers/fixtures'
import { syncProjectWorkFromTaskStatus, syncTaskFromProjectWorkStatus } from '@/lib/crm/services/projects'

describe('syncProjectWorkFromTaskStatus (calendar task -> project work)', () => {
  it('task marked DONE flips its linked work to DONE', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const task      = await tx.task.create({ data: { companyId, title: 'Test task', status: 'SCHEDULED' } })
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50 })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      await syncProjectWorkFromTaskStatus(tx, task.id, 'DONE')

      const updated = await tx.projectWork.findUnique({ where: { id: work.id } })
      expect(updated!.status).toBe('DONE')
    })
  })

  it('task moved away from DONE reverts its linked work to PLANNED', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const task      = await tx.task.create({ data: { companyId, title: 'Test task', status: 'DONE' } })
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50, status: 'DONE' })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      await syncProjectWorkFromTaskStatus(tx, task.id, 'IN_PROGRESS')

      const updated = await tx.projectWork.findUnique({ where: { id: work.id } })
      expect(updated!.status).toBe('PLANNED')
    })
  })

  it('never touches a work already MOVED_TO_INVOICE — terminal state', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const task      = await tx.task.create({ data: { companyId, title: 'Test task', status: 'SCHEDULED' } })
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50, status: 'MOVED_TO_INVOICE' })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      await syncProjectWorkFromTaskStatus(tx, task.id, 'DONE')

      const updated = await tx.projectWork.findUnique({ where: { id: work.id } })
      expect(updated!.status).toBe('MOVED_TO_INVOICE')
    })
  })

  it('is a no-op when the task has no linked work', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const task = await tx.task.create({ data: { companyId, title: 'Standalone task', status: 'SCHEDULED' } })
      await expect(syncProjectWorkFromTaskStatus(tx, task.id, 'DONE')).resolves.toBeUndefined()
    })
  })
})

describe('syncTaskFromProjectWorkStatus (project work -> calendar task)', () => {
  it('work marked DONE directly flips its linked task to DONE with completedAt set', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const task      = await tx.task.create({ data: { companyId, title: 'Test task', status: 'SCHEDULED' } })
      const work      = await makeProjectWork(tx, project.id, { laborCost: 50 })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      const alerts = await syncTaskFromProjectWorkStatus(tx, companyId, { taskId: task.id }, 'DONE')
      expect(alerts).toEqual([])

      const updatedTask = await tx.task.findUnique({ where: { id: task.id } })
      expect(updatedTask!.status).toBe('DONE')
      expect(updatedTask!.completedAt).not.toBeNull()
    })
  })

  it('writes off the linked task\'s own plannedMaterials, same as completing it from the calendar', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const item      = await makeInventoryItem(tx, companyId, { qtyInStock: 10, costPrice: 15 })
      const task = await tx.task.create({
        data: {
          companyId, title: 'Test task', status: 'SCHEDULED',
          plannedMaterials: [{ itemId: item.id, name: item.name, unit: item.unit, qty: '2' }],
        },
      })
      const work = await makeProjectWork(tx, project.id, { laborCost: 50 })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      await syncTaskFromProjectWorkStatus(tx, companyId, { taskId: task.id }, 'DONE')

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } })
      expect(new Decimal(updatedItem!.qtyInStock.toString()).toString()).toBe('8')

      const movement = await tx.stockMovement.findFirst({ where: { itemId: item.id, type: 'WRITE_OFF' } })
      expect(movement).not.toBeNull()

      const updatedTask = await tx.task.findUnique({ where: { id: task.id } })
      expect(updatedTask!.materialsWrittenOff).toBe(true)
    })
  })

  it('reverting work to PLANNED puts a done task back to SCHEDULED when it has a date', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const task = await tx.task.create({
        data: { companyId, title: 'Test task', status: 'DONE', completedAt: new Date(), scheduledAt: new Date('2026-09-10') },
      })
      const work = await makeProjectWork(tx, project.id, { laborCost: 50, status: 'DONE' })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      await syncTaskFromProjectWorkStatus(tx, companyId, { taskId: task.id }, 'PLANNED')

      const updatedTask = await tx.task.findUnique({ where: { id: task.id } })
      expect(updatedTask!.status).toBe('SCHEDULED')
      expect(updatedTask!.completedAt).toBeNull()
    })
  })

  it('reverting work to PLANNED puts a done task with no date back to NEW', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const boat      = await makeBoat(tx, clientId)
      const project   = await makeProject(tx, companyId, boat.id)
      const task = await tx.task.create({ data: { companyId, title: 'Test task', status: 'DONE', completedAt: new Date() } })
      const work = await makeProjectWork(tx, project.id, { laborCost: 50, status: 'DONE' })
      await tx.projectWork.update({ where: { id: work.id }, data: { taskId: task.id } })

      await syncTaskFromProjectWorkStatus(tx, companyId, { taskId: task.id }, 'PLANNED')

      const updatedTask = await tx.task.findUnique({ where: { id: task.id } })
      expect(updatedTask!.status).toBe('NEW')
    })
  })

  it('is a no-op when the work has no linked task', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const alerts = await syncTaskFromProjectWorkStatus(tx, companyId, { taskId: null }, 'DONE')
      expect(alerts).toEqual([])
    })
  })
})
