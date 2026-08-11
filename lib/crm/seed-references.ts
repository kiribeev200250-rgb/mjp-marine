import { Prisma, ReferenceType } from '@prisma/client'

interface RefItem {
  type:      ReferenceType
  value:     string
  label:     string
  sortOrder: number
}

// Стартовые данные справочников.
// Принимает tx (Prisma.TransactionClient) — должна вызываться ВНУТРИ
// уже открытой транзакции, не создаёт свою.
// companyId — id компании, созданной в той же транзакции.
export async function seedReferences(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  const items: RefItem[] = []

  // Категории расходов/доходов — не здесь: живут в Category (см.
  // seedCategories в lib/crm/seed-categories.ts), которую читают и веб, и
  // Telegram-бот. Раньше сюда же сеялся параллельный список
  // EXPENSE_CATEGORY/INCOME_CATEGORY, который читал только бот — расходился с
  // Category и требовал ручной синхронизации; убран вместе с переводом бота
  // на Category (см. lib/crm/telegram/conversations.ts).

  // Способы оплаты
  ;[
    { value: 'cash',     label: 'Наличные'         },
    { value: 'card',     label: 'Карта'             },
    { value: 'transfer', label: 'Перевод на счёт'   },
  ].forEach(({ value, label }, i) =>
    items.push({ type: ReferenceType.PAYMENT_METHOD, value, label, sortOrder: i }),
  )

  // Марины Коста-Бланки (~13 портов от Дении до Картахены)
  const marinas = [
    'Dénia', 'Jávea (Xàbia)', 'Calpe (Calp)', 'Altea', 'Benidorm',
    'Villajoyosa', 'El Campello', 'Alicante', 'Santa Pola', 'Torrevieja',
    'Guardamar', 'Cartagena', 'Mazarrón', 'Другая',
  ]
  marinas.forEach((label, i) =>
    items.push({ type: ReferenceType.MARINA, value: label, label, sortOrder: i }),
  )

  // Источники клиентов
  ;[
    { value: 'FACEBOOK',  label: 'Facebook'      },
    { value: 'MANUAL',    label: 'Вручную'        },
    { value: 'REFERRAL',  label: 'Рекомендация'   },
    { value: 'WEBSITE',   label: 'Сайт'           },
    { value: 'WHATSAPP',  label: 'WhatsApp'       },
    { value: 'OTHER',     label: 'Другое'         },
  ].forEach(({ value, label }, i) =>
    items.push({ type: ReferenceType.CLIENT_SOURCE, value, label, sortOrder: i }),
  )

  // Категории склада
  ;[
    'Запчасти двигателя', 'Такелаж', 'Электрика', 'Краски и антифоулинг',
    'Инструмент', 'Расходники', 'Другое',
  ].forEach((label, i) =>
    items.push({ type: ReferenceType.INVENTORY_CATEGORY, value: label, label, sortOrder: i }),
  )

  // Все upsert'ы через переданный tx — не создаём вложенную транзакцию
  await Promise.all(
    items.map((item) =>
      tx.referenceItem.upsert({
        where:  { companyId_type_value: { companyId, type: item.type, value: item.value } },
        create: { companyId, type: item.type, value: item.value, label: item.label, sortOrder: item.sortOrder },
        update: { label: item.label, sortOrder: item.sortOrder },
      }),
    ),
  )
}