import type { PrismaClient, VatDirection } from '@prisma/client'
import Decimal from 'decimal.js'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface RecordVatParams {
  direction:      VatDirection
  date:           Date
  baseAmount:     Decimal
  rate:           Decimal
  amount:         Decimal
  invoiceId?:     string
  financeEntryId?: string
  note?:          string
}

// Запись в IVA-книгу (repercutido/soportado). НИКОГДА не входит в P&L — только
// для расчёта «IVA к уплате» и квартальной аналитики. amount<=0 не пишется —
// IVA-запись существует только когда реально есть сумма IVA к учёту.
export async function recordVat(tx: Tx, companyId: string, params: RecordVatParams) {
  if (params.amount.lte(0)) return null

  return tx.vatEntry.create({
    data: {
      companyId,
      direction:      params.direction,
      date:           params.date,
      baseAmount:     params.baseAmount,
      rate:           params.rate,
      amount:         params.amount,
      invoiceId:      params.invoiceId,
      financeEntryId: params.financeEntryId,
      note:           params.note ?? '',
    },
  })
}
