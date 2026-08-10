import type { PrismaClient, CategoryKind } from '@prisma/client'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Найти категорию по имени или создать — для системных каскадов (оплата счёта,
// продажа со склада), которые сами не спрашивают пользователя, куда отнести доход.
// Не трогает archived: если категория архивная, не разархивирует автоматически —
// системный каскад создаёт новую с тем же именем только если такой ещё нет вовсе.
export async function findOrCreateCategory(
  tx: Tx,
  companyId: string,
  kind: CategoryKind,
  name: string,
): Promise<{ id: string; name: string }> {
  const existing = await tx.category.findUnique({
    where: { companyId_kind_name: { companyId, kind, name } },
  })
  if (existing) return existing

  const maxOrder = await tx.category.aggregate({ where: { companyId, kind }, _max: { sortOrder: true } })
  return tx.category.create({
    data: { companyId, kind, name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })
}
