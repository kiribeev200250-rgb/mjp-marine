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

// Атомарный инкремент счётчика через upsert по уникальному (companyId, key, year) —
// конкурентные вставки сериализуются на уровне строки в Postgres (тот же принцип,
// что и nextDocumentNumber выше). ОБЯЗАТЕЛЬНО вызывать внутри prisma.$transaction
// вместе с созданием самой записи, иначе номер может быть "зарезервирован", но не
// использован при откате транзакции (не страшно — просто пропуск в нумерации).
async function nextSequence(tx: Tx, companyId: string, key: string, year: number): Promise<number> {
  const counter = await tx.sequenceCounter.upsert({
    where:  { companyId_key_year: { companyId, key, year } },
    create: { companyId, key, year, value: 1 },
    update: { value: { increment: 1 } },
  })
  return counter.value
}

// Раньше считался через count() записей за год — гонка при параллельном вводе
// (два сотрудника одновременно создают расходы → могли получить один и тот же
// autoId). Теперь — атомарный счётчик, см. nextSequence. Вызывать ТОЛЬКО внутри
// prisma.$transaction.
export async function nextFinanceAutoId(tx: Tx, companyId: string, type: FinanceEntryType, year: number): Promise<string> {
  const prefix = FINANCE_PREFIX[type]
  const seq    = await nextSequence(tx, companyId, `FINANCE:${type}`, year)
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`
}

// См. nextFinanceAutoId — тот же атомарный паттерн. Вызывать ТОЛЬКО внутри prisma.$transaction.
export async function nextCapitalAutoId(tx: Tx, companyId: string, year: number): Promise<string> {
  const seq = await nextSequence(tx, companyId, 'CAPITAL', year)
  return `INV-${year}-${String(seq).padStart(3, '0')}`
}