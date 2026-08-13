import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { nextFinanceAutoId, nextCapitalAutoId } from '@/lib/crm/numbering'
import { createPersistedCompany, destroyPersistedCompany } from '../helpers/persistedCompany'

let companyId: string

afterEach(async () => {
  if (companyId) await destroyPersistedCompany(companyId)
})

describe('atomic finance/capital numbering', () => {
  it('never issues the same autoId twice under real concurrent transactions', async () => {
    ({ companyId } = await createPersistedCompany())
    const year = new Date().getFullYear()

    // Реальные конкурентные транзакции (не вложенные друг в друга) — именно
    // то, что раньше давало гонку через count(). Если атомарный счётчик
    // работает, все 10 id должны быть уникальны, без пропусков в середине.
    const ids = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.$transaction((tx) => nextFinanceAutoId(tx, companyId, 'EXPENSE', year)),
      ),
    )

    expect(new Set(ids).size).toBe(10)
  })

  it('keeps separate counters per type and per year', async () => {
    ({ companyId } = await createPersistedCompany())
    const year = new Date().getFullYear()

    const expenseId = await prisma.$transaction((tx) => nextFinanceAutoId(tx, companyId, 'EXPENSE', year))
    const incomeId  = await prisma.$transaction((tx) => nextFinanceAutoId(tx, companyId, 'INCOME',  year))
    const salaryId  = await prisma.$transaction((tx) => nextFinanceAutoId(tx, companyId, 'SALARY',  year))

    expect(expenseId).toBe(`EXP-${year}-001`)
    expect(incomeId).toBe(`INC-${year}-001`)
    expect(salaryId).toBe(`SAL-${year}-001`)
  })

  it('capital and finance counters are independent even at the same sequence number', async () => {
    ({ companyId } = await createPersistedCompany())
    const year = new Date().getFullYear()

    const financeId = await prisma.$transaction((tx) => nextFinanceAutoId(tx, companyId, 'EXPENSE', year))
    const capitalId = await prisma.$transaction((tx) => nextCapitalAutoId(tx, companyId, year))

    expect(financeId).toBe(`EXP-${year}-001`)
    expect(capitalId).toBe(`INV-${year}-001`)
  })

  it('increments monotonically across sequential calls', async () => {
    ({ companyId } = await createPersistedCompany())
    const year = new Date().getFullYear()

    const first  = await prisma.$transaction((tx) => nextCapitalAutoId(tx, companyId, year))
    const second = await prisma.$transaction((tx) => nextCapitalAutoId(tx, companyId, year))
    const third  = await prisma.$transaction((tx) => nextCapitalAutoId(tx, companyId, year))

    expect([first, second, third]).toEqual([`INV-${year}-001`, `INV-${year}-002`, `INV-${year}-003`])
  })
})
