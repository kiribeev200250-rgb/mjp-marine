import { describe, it, expect, afterEach } from 'vitest'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { recordPayment, refundPayment } from '@/lib/crm/services/invoiceCascade'
import { outstandingBalances } from '@/lib/crm/services/ar'
import { createPersistedCompany, destroyPersistedCompany } from '../helpers/persistedCompany'

// Регрессия: outstandingBalances изначально сравнивал total (брутто) напрямую
// с суммой FinanceEntry.amount (всегда нетто), занижая остаток ровно на IVA.
// Это единственный кейс в наборе, где нужны настоящие коммиты (recordPayment/
// refundPayment сами открывают $transaction, а outstandingBalances читает
// через синглтон prisma) — поэтому персистентная компания, не withRollback.
let companyId: string

afterEach(async () => {
  if (companyId) await destroyPersistedCompany(companyId)
})

describe('outstandingBalances', () => {
  it('for an ISSUED invoice (nothing paid), outstanding equals the full total', async () => {
    ({ companyId } = await createPersistedCompany({ ivaRate: 21 }))
    const client = await prisma.client.findFirstOrThrow({ where: { companyId } })
    const invoice = await prisma.invoice.create({
      data: {
        companyId, clientId: client.id, number: `T-F-${Date.now()}`, status: 'ISSUED',
        ivaRate: 21, irpfRate: 0, jobsTotal: 100, materialsTotal: 0, subtotal: 100,
        ivaAmount: 21, irpfAmount: 0, total: 121, clientName: 'Test Client',
      },
    })

    const balances = await outstandingBalances([invoice])
    expect(balances.get(invoice.id)!.toString()).toBe('121')
  })

  it('for a PARTIAL invoice (paid in full, then partially refunded), outstanding is the gross remainder — not paidNet subtracted from gross total', async () => {
    ({ companyId } = await createPersistedCompany({ ivaRate: 21 }))
    const client = await prisma.client.findFirstOrThrow({ where: { companyId } })
    const invoice = await prisma.invoice.create({
      data: {
        companyId, clientId: client.id, number: `T-F-${Date.now()}`, status: 'ISSUED',
        ivaRate: 21, irpfRate: 0, jobsTotal: 100, materialsTotal: 0, subtotal: 100,
        ivaAmount: 21, irpfAmount: 0, total: 121, clientName: 'Test Client',
      },
    })

    await prisma.$transaction((tx) =>
      recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId: client.id, status: 'ISSUED',
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      }),
    )
    await prisma.$transaction((tx) =>
      refundPayment(tx, companyId, null, { id: invoice.id, number: invoice.number, clientId: client.id, ivaRate: invoice.ivaRate }, new Decimal(40), 'partial refund'),
    )

    const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })
    expect(refreshed.status).toBe('PARTIAL')

    const balances = await outstandingBalances([refreshed])
    // 40 net refunded * 1.21 = 48.4 gross — NOT 121 - 40 = 81 (comparing gross
    // total to net paid, the original bug), and not 121 - 100 = 21 either.
    expect(balances.get(invoice.id)!.toString()).toBe('48.4')
  })

  it('for a fully PAID invoice, outstanding is zero', async () => {
    ({ companyId } = await createPersistedCompany({ ivaRate: 21 }))
    const client = await prisma.client.findFirstOrThrow({ where: { companyId } })
    const invoice = await prisma.invoice.create({
      data: {
        companyId, clientId: client.id, number: `T-F-${Date.now()}`, status: 'ISSUED',
        ivaRate: 21, irpfRate: 0, jobsTotal: 100, materialsTotal: 0, subtotal: 100,
        ivaAmount: 21, irpfAmount: 0, total: 121, clientName: 'Test Client',
      },
    })
    await prisma.$transaction((tx) =>
      recordPayment(tx, companyId, {
        id: invoice.id, number: invoice.number, clientId: client.id, status: 'ISSUED',
        paymentMethod: '', subtotal: invoice.subtotal, ivaAmount: invoice.ivaAmount, ivaRate: invoice.ivaRate,
      }),
    )

    const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })
    const balances = await outstandingBalances([refreshed])
    expect(balances.get(invoice.id)!.toString()).toBe('0')
  })
})
