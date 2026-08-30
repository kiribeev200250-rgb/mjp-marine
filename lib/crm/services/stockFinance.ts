import type { PrismaClient, FinanceEntryType } from '@prisma/client'
import Decimal from 'decimal.js'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import { findOrCreateCategory } from './categories'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const CATEGORY_BY_KIND: Record<'RECEIVE' | 'SELL', { type: FinanceEntryType; name: string }> = {
  RECEIVE: { type: 'EXPENSE', name: 'Закупка склад' },
  SELL:    { type: 'INCOME',  name: 'Продажа запчастей' },
}

// Приход на склад — это реальная покупка за свои деньги (расход из кассы
// сейчас), продажа со склада — реальный доход (сейчас, не когда-то потом).
// Списание в работу (WRITE_OFF) сюда не входит — его стоимость клиенту уже
// учитывается через счёт, отдельная проводка задвоила бы расход. ADJUST/ORDER
// тоже не входят — корректировка и «в пути» деньги не двигают.
//
// unitPrice === 0 (бесплатный приход/образец без цены) не создаёт запись —
// нулевой расход/доход в кассе не нужен и засорял бы ленту операций.
// Вызывать ТОЛЬКО внутри prisma.$transaction вместе с самим движением склада.
export async function recordStockFinanceEntry(
  tx: Tx,
  companyId: string,
  item: { id: string; name: string },
  kind: 'RECEIVE' | 'SELL',
  total: Decimal,
): Promise<{ id: string; autoId: string } | null> {
  if (total.lte(0)) return null

  const { type, name } = CATEGORY_BY_KIND[kind]
  const category = await findOrCreateCategory(tx, companyId, type, name)
  const autoId   = await nextFinanceAutoId(tx, companyId, type, new Date().getFullYear())

  const entry = await tx.financeEntry.create({
    data: {
      companyId,
      autoId,
      type,
      date:        new Date(),
      category:    category.name,
      categoryId:  category.id,
      amountExpr:  total.toString(),
      amount:      total,
      description: `${kind === 'SELL' ? 'Продажа' : 'Закупка'}: ${item.name}`,
    },
  })
  return { id: entry.id, autoId: entry.autoId }
}
