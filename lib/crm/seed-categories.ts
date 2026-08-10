import { Prisma, CategoryKind } from '@prisma/client'

// Стартовые категории финансов — совпадают с листами Google Sheets («Расходы»/
// «Доходы»), чтобы CRM не отставала от книги с первого дня. Дальше категории
// растут «на лету» из формы ввода — этот список только начальный набор.
// Вызывать ВНУТРИ уже открытой транзакции (см. seed-references.ts — тот же паттерн).
export async function seedCategories(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  const expenseCategories = [
    'Лизинг / аренда авто',
    'Топливо и транспорт',
    'Инструмент и оборудование',
    'Расходные материалы',
    'Реклама — Facebook',
    'Реклама — Google',
    'Реклама — TikTok',
    'Реклама — другое',
    'Страховка',
    'Связь и интернет',
    'Аренда квартиры',
    'Переезд',
    'Прочие расходы',
  ]

  const incomeCategories = [
    'Работы по фактуре',
    'Ремонт двигателя',
    'Обслуживание корпуса',
    'Покраска и антифоулинг',
    'Электрика и электроника',
    'Такелаж и парусное',
    'Продажа запчастей',
    'Диагностика',
    'Прочие доходы',
  ]

  const rows: { kind: CategoryKind; name: string; sortOrder: number }[] = [
    ...expenseCategories.map((name, i) => ({ kind: CategoryKind.EXPENSE, name, sortOrder: i })),
    ...incomeCategories.map((name, i) => ({ kind: CategoryKind.INCOME, name, sortOrder: i })),
  ]

  await Promise.all(
    rows.map((row) =>
      tx.category.upsert({
        where:  { companyId_kind_name: { companyId, kind: row.kind, name: row.name } },
        create: { companyId, kind: row.kind, name: row.name, sortOrder: row.sortOrder },
        update: { sortOrder: row.sortOrder },
      }),
    ),
  )
}
