import type { PrismaClient, FinanceEntryType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Атомарная генерация сквозного номера счёта/пресмета за год.
// Использует CompanyInfo.nextInvoiceNum / nextQuoteNum, сбрасывая ОБА счётчика при смене года.
// Вызывать ТОЛЬКО внутри prisma.$transaction — иначе возможна гонка (два счёта с одним номером).
export async function nextDocumentNumber(
  tx: Tx,
  companyId: string,
  kind: 'invoice' | 'quote',
): Promise<{ number: string; year: number; sequenceNum: number }> {
  const info = await tx.companyInfo.findUniqueOrThrow({ where: { companyId } })

  const year        = new Date().getFullYear()
  const yearChanged  = info.currentYear !== year

  const invoiceStart = yearChanged ? 1 : info.nextInvoiceNum
  const quoteStart    = yearChanged ? 1 : info.nextQuoteNum

  const sequenceNum = kind === 'invoice' ? invoiceStart : quoteStart
  const prefix      = kind === 'invoice' ? info.invoicePrefix : info.quotePrefix

  await tx.companyInfo.update({
    where: { companyId },
    data: {
      currentYear:    year,
      nextInvoiceNum: kind === 'invoice' ? sequenceNum + 1 : invoiceStart,
      nextQuoteNum:   kind === 'quote'   ? sequenceNum + 1 : quoteStart,
    },
  })

  const number = `${prefix}${year}-${String(sequenceNum).padStart(3, '0')}`
  return { number, year, sequenceNum }
}

const FINANCE_PREFIX: Record<FinanceEntryType, string> = {
  INCOME:  'INC',
  EXPENSE: 'EXP',
  SALARY:  'SAL',
}

// Счётчик по count() записей за год — как в app/api/crm/finance/route.ts.
// Не атомарно (без $transaction на уровне БД), но коллизии крайне маловероятны
// при текущей нагрузке (один пользователь Telegram-бота вводит записи вручную).
export async function nextFinanceAutoId(companyId: string, type: FinanceEntryType, year: number): Promise<string> {
  const prefix = FINANCE_PREFIX[type]
  const count = await prisma.financeEntry.count({
    where: {
      companyId,
      type,
      date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`
}

export async function nextCapitalAutoId(companyId: string, year: number): Promise<string> {
  const count = await prisma.capitalEntry.count({
    where: {
      companyId,
      date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    },
  })
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`
}