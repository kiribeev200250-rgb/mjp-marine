import { prisma } from '@/lib/prisma'
import Decimal from 'decimal.js'

// Некоторые сервисы (computeCashSummary, outstandingBalances, detectFinancialAnomalies,
// numbering-счётчики под настоящей гонкой) читают через синглтон `prisma`, а не
// принимают `tx` — их не проверить внутри withRollback (другая транзакция не видит
// незакоммиченные строки чужого соединения). Для них — реальная, персистентная
// throwaway-компания, которую тест обязан снести сам (afterEach/afterAll) — тот же
// принцип, что и ручная уборка ZZTEST-данных при живой проверке в этом проекте,
// просто автоматизированный.
export async function createPersistedCompany(opts?: { ivaRate?: number }) {
  const company = await prisma.company.create({ data: { name: `TEST company (persisted) ${Date.now()}` } })
  await prisma.companyInfo.create({
    data: { companyId: company.id, ivaRate: new Decimal(opts?.ivaRate ?? 21) },
  })
  const client = await prisma.client.create({
    data: { companyId: company.id, firstName: 'Test', lastName: 'Client' },
  })
  return { companyId: company.id, clientId: client.id }
}

// Порядок удаления — по внешним ключам, дети раньше родителей.
export async function destroyPersistedCompany(companyId: string) {
  await prisma.vatEntry.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.financeEntry.deleteMany({ where: { companyId } })
  await prisma.capitalEntry.deleteMany({ where: { companyId } })
  await prisma.invoiceMaterial.deleteMany({ where: { job: { invoice: { companyId } } } })
  await prisma.invoiceJob.deleteMany({ where: { invoice: { companyId } } })
  await prisma.invoice.deleteMany({ where: { companyId } })
  await prisma.inventoryItem.deleteMany({ where: { companyId } })
  await prisma.sequenceCounter.deleteMany({ where: { companyId } })
  await prisma.periodLock.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.funnelHistory.deleteMany({ where: { client: { companyId } } })
  await prisma.client.deleteMany({ where: { companyId } })
  await prisma.crmUser.deleteMany({ where: { companyId } })
  await prisma.companyInfo.deleteMany({ where: { companyId } })
  // recordPayment/refundPayment (findOrCreateCategory) create a Category on
  // the fly if none exists yet — clean those up too, or the FK on Company blocks delete.
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.company.delete({ where: { id: companyId } })
}
