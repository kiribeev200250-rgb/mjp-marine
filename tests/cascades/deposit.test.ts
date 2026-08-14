import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeInvoice } from '../helpers/fixtures'
import { recordDeposit, recordPayment } from '@/lib/crm/services/invoiceCascade'

describe('recordDeposit', () => {
  it('splits a gross deposit into net + IVA and moves the invoice to PARTIAL', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 }) // total 121

      // Client pays 36.30 EUR gross as a deposit (30% of 121)
      const lines = await recordDeposit(tx, companyId, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal('36.30'))
      expect(lines.length).toBeGreaterThan(0)

      const entry = await tx.financeEntry.findFirst({ where: { invoiceId: invoice.id, type: 'INCOME' } })
      expect(entry).not.toBeNull()
      // 36.30 / 1.21 = 30.00 net, 6.30 IVA
      expect(new Decimal(entry!.amount.toString()).toString()).toBe('30')

      const vat = await tx.vatEntry.findFirst({ where: { invoiceId: invoice.id } })
      expect(vat).not.toBeNull()
      expect(new Decimal(vat!.amount.toString()).toString()).toBe('6.3')

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('PARTIAL')
      expect(updated!.paidAt).toBeNull()
    })
  })

  it('a deposit covering the full remaining balance jumps straight to PAID', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 }) // total 121

      await recordDeposit(tx, companyId, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal('121'))

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('PAID')
      expect(updated!.paidAt).not.toBeNull()
    })
  })

  it('rejects a deposit larger than the remaining balance', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 })

      await expect(
        recordDeposit(tx, companyId, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal('200')),
      ).rejects.toThrow()
    })
  })

  it('rejects a zero or negative deposit', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100 })

      await expect(
        recordDeposit(tx, companyId, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(0)),
      ).rejects.toThrow()
    })
  })

  it('rejects a deposit on an already-paid or cancelled invoice', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, status: 'CANCELLED' })

      await expect(
        recordDeposit(tx, companyId, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(10)),
      ).rejects.toThrow()
    })
  })

  it('final payment after a deposit pays only the remainder, not the full subtotal again', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 })

      // Deposit: 30 net (36.30 gross)
      await recordDeposit(tx, companyId, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal('36.30'))

      // Final payment should only add the remaining 70 net, not another 100
      await recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId, status: 'PARTIAL',
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      })

      const entries = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
      const totalNet = entries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
      expect(totalNet.toString()).toBe('100')

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('PAID')
    })
  })
})
