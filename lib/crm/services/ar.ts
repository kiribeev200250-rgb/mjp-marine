import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface InvoiceForBalance {
  id:      string
  total:   unknown
  ivaRate: unknown
}

// Остаток к получению по счёту: total (брутто) минус уже зачтённая оплата,
// переведённая из нетто в брутто. FinanceEntry.amount ВСЕГДА нетто (без IVA —
// см. схему), а recordPayment/refundPayment в invoiceCascade.ts всегда берут
// ivaRate из самого счёта при зачислении — поэтому paidNet * (1 + ivaRate/100)
// даёт ту же базу (брутто), что и total. Сравнивать total напрямую с paidNet
// (без пересчёта) было бы ошибкой — недосчитывалась бы ровно сумма IVA.
//
// Для ISSUED/OVERDUE (ничего ещё не платили) это равно total. Для PARTIAL
// (частично возвращённая ранее полная оплата, см. refundPayment) это меньше
// total — раньше дебиторка везде считала полный total даже для PARTIAL.
export async function outstandingBalances(
  invoices: InvoiceForBalance[],
  tx: Tx = prisma,
): Promise<Map<string, Decimal>> {
  const result = new Map<string, Decimal>()
  if (invoices.length === 0) return result

  const paid = await tx.financeEntry.groupBy({
    by:    ['invoiceId'],
    where: { invoiceId: { in: invoices.map((i) => i.id) }, type: 'INCOME' },
    _sum:  { amount: true },
  })
  const paidNetMap = new Map(paid.map((p) => [p.invoiceId as string, new Decimal((p._sum.amount ?? 0).toString())]))

  for (const inv of invoices) {
    const total     = new Decimal(String(inv.total))
    const ivaRate   = new Decimal(String(inv.ivaRate))
    const paidNet   = paidNetMap.get(inv.id) ?? new Decimal(0)
    const paidGross = paidNet.times(ivaRate.div(100).plus(1))
    result.set(inv.id, Decimal.max(0, total.minus(paidGross)))
  }
  return result
}
