import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { computeCashSummary } from '@/lib/crm/services/cash'
import { createPersistedCompany, destroyPersistedCompany } from '../helpers/persistedCompany'

let companyId: string

beforeEach(async () => {
  ({ companyId } = await createPersistedCompany())
})

afterEach(async () => {
  await destroyPersistedCompany(companyId)
})

describe('computeCashSummary', () => {
  it('cash = reinvested + income(net) + vatRepercutido − expense(net) − vatSoportado − salary − irpfWithheld', async () => {
    await prisma.capitalEntry.create({ data: { companyId, autoId: `T-CAP-${Date.now()}`, type: 'REINVESTMENT', date: new Date(), amount: 500, source: 'owner' } })
    await prisma.financeEntry.create({ data: { companyId, autoId: `T-INC-${Date.now()}`, type: 'INCOME',  date: new Date(), category: 'Work',   amountExpr: '100', amount: 100 } })
    await prisma.financeEntry.create({ data: { companyId, autoId: `T-EXP-${Date.now()}`, type: 'EXPENSE', date: new Date(), category: 'Parts',  amountExpr: '30',  amount: 30 } })
    await prisma.financeEntry.create({ data: { companyId, autoId: `T-SAL-${Date.now()}`, type: 'SALARY',  date: new Date(), category: 'Salary', amountExpr: '20',  amount: 20 } })
    await prisma.vatEntry.create({ data: { companyId, direction: 'REPERCUTIDO', date: new Date(), baseAmount: 100, rate: 21, amount: 21 } })
    await prisma.vatEntry.create({ data: { companyId, direction: 'SOPORTADO',   date: new Date(), baseAmount: 30,  rate: 21, amount: 6.3 } })

    const summary = await computeCashSummary(companyId)
    // 500 + 100 + 21 - 30 - 6.3 - 20 = 564.7
    expect(summary.cash.toString()).toBe('564.7')
    expect(summary.personalInProject.toString()).toBe('0')
    expect(summary.vatPayable.toString()).toBe('14.7')
    expect(summary.totalInvested.toString()).toBe('500')
  })

  it('personalInProject reflects the shortfall when cash goes negative (owner funding the gap)', async () => {
    await prisma.financeEntry.create({ data: { companyId, autoId: `T-EXP-${Date.now()}`, type: 'EXPENSE', date: new Date(), category: 'Parts', amountExpr: '200', amount: 200 } })
    // Никаких доходов/доинвестиций — касса должна уйти в минус на всю сумму расхода

    const summary = await computeCashSummary(companyId)
    expect(summary.cash.toString()).toBe('-200')
    expect(summary.personalInProject.toString()).toBe('200')
  })

  it('IRPF withheld on paid invoices reduces cash without touching vatPayable', async () => {
    const client = await prisma.client.findFirstOrThrow({ where: { companyId } })
    await prisma.invoice.create({
      data: {
        companyId, clientId: client.id, number: `T-F-${Date.now()}`, status: 'PAID',
        ivaRate: 21, irpfRate: 15, jobsTotal: 100, materialsTotal: 0, subtotal: 100,
        ivaAmount: 21, irpfAmount: 15, total: 106, clientName: 'Test Client',
      },
    })

    const summary = await computeCashSummary(companyId)
    expect(summary.irpfWithheld.toString()).toBe('15')
    expect(summary.cash.toString()).toBe('-15')
    expect(summary.vatPayable.toString()).toBe('0')
  })

  it('a REINVESTMENT capital entry moves cash but never touches P&L (FinanceEntry) at all', async () => {
    await prisma.capitalEntry.create({ data: { companyId, autoId: `T-CAP-${Date.now()}`, type: 'REINVESTMENT', date: new Date(), amount: 300, source: 'owner' } })

    const financeCount = await prisma.financeEntry.count({ where: { companyId } })
    expect(financeCount).toBe(0)

    const summary = await computeCashSummary(companyId)
    expect(summary.cash.toString()).toBe('300')
  })

  it('STARTUP_ASSET/STARTUP_SUNK capital never enters cash — only REINVESTMENT does', async () => {
    await prisma.capitalEntry.create({ data: { companyId, autoId: `T-CAP-A-${Date.now()}`, type: 'STARTUP_ASSET', date: new Date(), amount: 1000, source: 'van' } })
    await prisma.capitalEntry.create({ data: { companyId, autoId: `T-CAP-S-${Date.now()}`, type: 'STARTUP_SUNK',  date: new Date(), amount: 500,  source: 'deposit' } })

    const summary = await computeCashSummary(companyId)
    expect(summary.cash.toString()).toBe('0')
    expect(summary.totalInvested.toString()).toBe('1500')
  })
})
