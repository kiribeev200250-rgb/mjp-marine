import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Закрытый период, в который попадает date, или null если период открыт.
// Принимает необязательный tx для проверки внутри той же транзакции, что и мутация.
export async function findActivePeriodLock(companyId: string, date: Date, tx?: Tx) {
  const client = tx ?? prisma
  return client.periodLock.findFirst({
    where: { companyId, startDate: { lte: date }, endDate: { gt: date } },
  })
}
