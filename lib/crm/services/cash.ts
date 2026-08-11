import { prisma } from '@/lib/prisma'
import Decimal from 'decimal.js'

export interface CashSummary {
  cash:              Decimal
  personalInProject: Decimal
  reinvested:        Decimal
  startupAsset:      Decimal
  startupSunk:       Decimal
  totalInvested:     Decimal
  vatRepercutido:    Decimal
  vatSoportado:      Decimal
  vatPayable:        Decimal
  irpfWithheld:      Decimal
}

// Единая формула кассы и «личных денег в проекте» — используется на дашборде,
// странице финансов и в P&L-отчёте, чтобы все три места никогда не разошлись.
//
// Касса — живые деньги, поэтому считается на ВАЛОВЫХ суммах:
//   cash = доинвестиции + доход(нетто) + IVA repercutido
//        − расход(нетто) − IVA soportado − зарплаты − IRPF (удержан клиентом,
//          в кассу физически не попадает)
// P&L при этом остаётся чистым (нетто) — IVA туда не входит вовсе.
// Личные в проекте = -cash, если касса отрицательная (иначе 0).
export async function computeCashSummary(companyId: string): Promise<CashSummary> {
  const [financeByType, capitalByType, vatByDirection, irpfAgg] = await Promise.all([
    prisma.financeEntry.groupBy({ by: ['type'], where: { companyId }, _sum: { amount: true } }),
    prisma.capitalEntry.groupBy({ by: ['type'], where: { companyId }, _sum: { amount: true } }),
    prisma.vatEntry.groupBy({ by: ['direction'], where: { companyId }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { companyId, status: 'PAID' }, _sum: { irpfAmount: true } }),
  ])

  const financeMap = Object.fromEntries(financeByType.map((f) => [f.type, new Decimal(f._sum.amount?.toString() ?? 0)]))
  const capitalMap = Object.fromEntries(capitalByType.map((c) => [c.type, new Decimal(c._sum.amount?.toString() ?? 0)]))
  const vatMap     = Object.fromEntries(vatByDirection.map((v) => [v.direction, new Decimal(v._sum.amount?.toString() ?? 0)]))

  const income  = financeMap['INCOME']  ?? new Decimal(0)
  const expense = financeMap['EXPENSE'] ?? new Decimal(0)
  const salary  = financeMap['SALARY']  ?? new Decimal(0)

  const reinvested   = capitalMap['REINVESTMENT']  ?? new Decimal(0)
  const startupAsset = capitalMap['STARTUP_ASSET'] ?? new Decimal(0)
  const startupSunk  = capitalMap['STARTUP_SUNK']  ?? new Decimal(0)

  const vatRepercutido = vatMap['REPERCUTIDO'] ?? new Decimal(0)
  const vatSoportado   = vatMap['SOPORTADO']   ?? new Decimal(0)
  const irpfWithheld   = new Decimal(irpfAgg._sum.irpfAmount?.toString() ?? 0)

  const cash = reinvested
    .plus(income).plus(vatRepercutido)
    .minus(expense).minus(vatSoportado)
    .minus(salary)
    .minus(irpfWithheld)

  const personalInProject = cash.isNegative() ? cash.abs() : new Decimal(0)

  return {
    cash,
    personalInProject,
    reinvested,
    startupAsset,
    startupSunk,
    totalInvested: reinvested.plus(startupAsset).plus(startupSunk),
    vatRepercutido,
    vatSoportado,
    vatPayable: vatRepercutido.minus(vatSoportado),
    irpfWithheld,
  }
}
