import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeInvoice } from '../helpers/fixtures'
import { recordPayment, refundPayment, reversePayment } from '@/lib/crm/services/invoiceCascade'

async function payInvoice(tx: Parameters<typeof recordPayment>[0], companyId: string, invoice: Awaited<ReturnType<typeof makeInvoice>>, clientId: string) {
  await recordPayment(tx, companyId, {
    id: invoice.id, number: invoice.number, clientId, status: invoice.status,
    paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
  })
}

describe('refundPayment', () => {
  it('partial refund: creates a negative income entry, a negative VAT entry, and sets status to PARTIAL', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 })
      await payInvoice(tx, companyId, invoice, clientId)

      await refundPayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(40), 'test refund')

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('PARTIAL')

      const refundEntry = await tx.financeEntry.findFirst({ where: { invoiceId: invoice.id, amount: { lt: 0 } } })
      expect(refundEntry).not.toBeNull()
      expect(new Decimal(refundEntry!.amount.toString()).toString()).toBe('-40')
      expect(refundEntry!.reversalOfId).not.toBeNull()

      const refundVat = await tx.vatEntry.findFirst({ where: { invoiceId: invoice.id, amount: { lt: 0 } } })
      expect(refundVat).not.toBeNull()
      // 40 * 21% = 8.4
      expect(new Decimal(refundVat!.amount.toString()).toString()).toBe('-8.4')

      // Net paid so far: 100 - 40 = 60, still > 0
      const allPayments = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
      const netPaid = allPayments.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
      expect(netPaid.toString()).toBe('60')
    })
  })

  it('full refund of the entire paid amount reopens the invoice to ISSUED and clears paidAt', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 })
      await payInvoice(tx, companyId, invoice, clientId)

      await refundPayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(100), 'full refund')

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('ISSUED')
      expect(updated!.paidAt).toBeNull()

      const client = await tx.client.findUnique({ where: { id: clientId } })
      expect(client!.funnelStage).toBe('INVOICE_SENT')
    })
  })

  it('rejects a refund larger than what was actually paid', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100 })
      await payInvoice(tx, companyId, invoice, clientId)

      await expect(
        refundPayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(150), 'too much'),
      ).rejects.toThrow()
    })
  })

  it('rejects a zero or negative refund amount', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100 })
      await payInvoice(tx, companyId, invoice, clientId)

      await expect(
        refundPayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(0), ''),
      ).rejects.toThrow()
    })
  })

  it('is a no-op on an invoice that was never paid', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, status: 'ISSUED' })

      await expect(
        refundPayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, ivaRate: invoice.ivaRate }, new Decimal(10), ''),
      ).rejects.toThrow()
    })
  })
})

describe('reversePayment', () => {
  it('cancels the entire payment in one call (thin wrapper over refundPayment for the full amount)', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 })
      await payInvoice(tx, companyId, invoice, clientId)

      const lines = await reversePayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, status: 'PAID', ivaRate: invoice.ivaRate })
      expect(lines.length).toBeGreaterThan(0)

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('ISSUED')

      const allPayments = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
      const netPaid = allPayments.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
      expect(netPaid.toString()).toBe('0')
    })
  })

  it('is a no-op on an invoice with nothing paid', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, status: 'ISSUED' })

      const lines = await reversePayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId, status: 'ISSUED', ivaRate: invoice.ivaRate })
      expect(lines).toEqual([])
    })
  })
})
