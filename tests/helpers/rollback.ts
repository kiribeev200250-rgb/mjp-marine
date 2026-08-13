import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

class RollbackSentinel extends Error {}

// Выполняет fn внутри одной транзакции и всегда откатывает её в конце (даже
// при успехе) — ничего не остаётся в базе, независимо от того, что делает fn
// внутри (create/update/delete). Денежные каскады (recordPayment,
// refundPayment, writeOffInvoiceMaterials, ...) уже принимают tx как первый
// параметр — специально для того, чтобы их можно было гонять в чужой
// транзакции — поэтому тестировать их так можно без единой строчки моков и
// без ручной уборки за собой, безопасно даже против общей dev-БД.
//
// Не годится для того, что должно быть видно ИЗ ДРУГОГО соединения (напр.
// проверка гонки при параллельных транзакциях) — для этого нужны реальные
// коммиты, см. tests/helpers/persistedCompany.ts.
export async function withRollback<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let result!: T
  try {
    await prisma.$transaction(async (tx) => {
      result = await fn(tx)
      throw new RollbackSentinel('intentional rollback — not a real failure')
    })
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e
  }
  return result
}
