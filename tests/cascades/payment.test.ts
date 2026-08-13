import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { withRollback } from '../helpers/rollback'
import { makeCompany, makeClient, makeInvoice } from '../helpers/fixtures'
import { recordPayment } from '@/lib/crm/services/invoiceCascade'

describe('recordPayment', () => {
  it('records net income (no IVA), a matching VAT repercutido entry, and marks the invoice PAID', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 21 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 100, ivaRate: 21 })
      expect(invoice.total.toString()).toBe('121')

      const lines = await recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId, status: invoice.status,
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      })
      expect(lines.length).toBeGreaterThan(0)

      const entry = await tx.financeEntry.findFirst({ where: { invoiceId: invoice.id, type: 'INCOME' } })
      expect(entry).not.toBeNull()
      // P&L только нетто — сумма дохода равна subtotal (базе), не total (с IVA)
      expect(new Decimal(entry!.amount.toString()).toString()).toBe('100')

      const vat = await tx.vatEntry.findFirst({ where: { invoiceId: invoice.id } })
      expect(vat).not.toBeNull()
      expect(vat!.direction).toBe('REPERCUTIDO')
      expect(new Decimal(vat!.baseAmount.toString()).toString()).toBe('100')
      expect(new Decimal(vat!.amount.toString()).toString()).toBe('21')

      const updated = await tx.invoice.findUnique({ where: { id: invoice.id } })
      expect(updated!.status).toBe('PAID')
      expect(updated!.paidAt).not.toBeNull()

      const client = await tx.client.findUnique({ where: { id: clientId } })
      expect(client!.funnelStage).toBe('PAID')
    })
  })

  it('is idempotent — calling it again on an already-PAID invoice does nothing', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx)
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 50 })

      await recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId, status: invoice.status,
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      })
      const secondCallLines = await recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId, status: 'PAID',
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      })
      expect(secondCallLines).toEqual([])

      const entries = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
      expect(entries.length).toBe(1)
    })
  })

  it('handles a zero-IVA invoice without creating a VAT entry', async () => {
    await withRollback(async (tx) => {
      const companyId = await makeCompany(tx, { ivaRate: 0 })
      const clientId  = await makeClient(tx, companyId)
      const invoice   = await makeInvoice(tx, companyId, clientId, { subtotal: 80, ivaRate: 0 })

      await recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId, status: invoice.status,
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      })

      const vat = await tx.vatEntry.findFirst({ where: { invoiceId: invoice.id } })
      expect(vat).toBeNull()
    })
  })
})
