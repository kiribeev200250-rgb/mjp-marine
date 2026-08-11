import type { Conversation } from '@grammyjs/conversations'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/crm/audit'
import { parseAmountExpr, PAYMENT_METHODS } from '@/lib/crm/utils'
import { nextFinanceAutoId, nextCapitalAutoId } from '@/lib/crm/numbering'
import { findOrCreateCategory } from '@/lib/crm/services/categories'
import { getLinkedUser, can } from './auth'
import { notifyAdmins } from './notify'
import type { MyContext } from './types'
import type { FinanceEntryType, CategoryKind } from '@prisma/client'

type Convo = Conversation<MyContext, MyContext>

const CANCEL_WORDS = ['/cancel', 'отмена', 'cancel']

function isCancel(text: string): boolean {
  return CANCEL_WORDS.includes(text.trim().toLowerCase())
}

async function requireLinked(conversation: Convo, ctx: MyContext) {
  const telegramId = String(ctx.from?.id ?? '')
  const user = await conversation.external(() => getLinkedUser(telegramId))
  if (!user) {
    await ctx.reply('Аккаунт не привязан. Отправьте /link <код> — код возьмите в CRM → Настройки.')
    return null
  }
  return user
}

// Категории — из того же живого списка (Category), что и веб, а не из
// отдельного ReferenceItem, который не растёт вместе с CategoryCombobox в вебе
// и годами расходится с реальным списком. Текст, не совпавший ни с одним
// номером/названием, заводит новую категорию «на лету» — как «+Добавить» в
// вебовском CategoryCombobox.
async function pickCategory(
  conversation: Convo,
  ctx: MyContext,
  companyId: string,
  kind: CategoryKind,
): Promise<string | null> {
  const categories = await conversation.external(() =>
    prisma.category.findMany({
      where: { companyId, kind, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  )

  const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
  await ctx.reply(`Категория?\n${list}\n\nНомер из списка или новое название текстом. /cancel — отмена.`)

  const msg = await conversation.waitFor('message:text')
  const text = msg.message.text.trim()
  if (isCancel(text)) return null

  const idx = parseInt(text, 10)
  if (!isNaN(idx) && categories[idx - 1]) return categories[idx - 1].name

  const created = await conversation.external(() => findOrCreateCategory(prisma, companyId, kind, text))
  return created.name
}

async function askAmount(conversation: Convo, ctx: MyContext, prompt: string): Promise<Decimal | null> {
  await ctx.reply(`${prompt}\nМожно выражение (напр. 168.23/2). /cancel — отмена.`)
  for (;;) {
    const msg = await conversation.waitFor('message:text')
    const text = msg.message.text.trim()
    if (isCancel(text)) return null
    try {
      const amount = parseAmountExpr(text)
      if (amount.lte(0)) throw new Error('Сумма должна быть больше нуля')
      return amount
    } catch (e) {
      await ctx.reply(e instanceof Error ? e.message : 'Некорректная сумма, попробуйте ещё раз')
    }
  }
}

async function askPaymentMethod(conversation: Convo, ctx: MyContext): Promise<string | null> {
  await ctx.reply(
    `Способ оплаты?\n${PAYMENT_METHODS.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\n/cancel — отмена.`,
  )
  const msg = await conversation.waitFor('message:text')
  const text = msg.message.text.trim()
  if (isCancel(text)) return null
  const idx = parseInt(text, 10)
  return (!isNaN(idx) && PAYMENT_METHODS[idx - 1]) ? PAYMENT_METHODS[idx - 1] : text
}

// /expense и /income — единый сценарий, параметризованный типом.
// receiptUrl передаётся при входе из фото-хендлера (см. bot.ts).
export async function moneyEntryConversation(
  conversation: Convo,
  ctx: MyContext,
  args: { type: FinanceEntryType; receiptUrl?: string } = { type: 'EXPENSE' },
) {
  const { type, receiptUrl } = args
  const user = await requireLinked(conversation, ctx)
  if (!user) return
  if (!can(user, 'FINANCE', 'CREATE')) {
    await ctx.reply('Недостаточно прав для записи финансов.')
    return
  }

  const category = await pickCategory(conversation, ctx, user.companyId, type)
  if (category === null) { await ctx.reply('Отменено.'); return }

  const amount = await askAmount(conversation, ctx, `Сумма (${type === 'INCOME' ? 'доход' : 'расход'})?`)
  if (amount === null) { await ctx.reply('Отменено.'); return }

  const paymentMethod = await askPaymentMethod(conversation, ctx)
  if (paymentMethod === null) { await ctx.reply('Отменено.'); return }

  // conversation.external() клонирует возвращаемое значение (structuredClone) для
  // журнала повторов — Decimal и другие поля Prisma-модели не клонируются,
  // возвращаем только простой примитив.
  const autoId = await conversation.external(async () => {
    const year   = new Date().getFullYear()
    const newId  = await nextFinanceAutoId(user.companyId, type, year)
    const e = await prisma.financeEntry.create({
      data: {
        companyId:     user.companyId,
        autoId:        newId,
        type,
        date:          new Date(),
        category,
        amountExpr:    amount.toString(),
        amount,
        paymentMethod,
        description:   'Через Telegram-бота',
        ...(receiptUrl && { receiptUrl }),
      },
    })
    await writeAudit({
      companyId: user.companyId,
      userId:    user.id,
      action:    'CREATE',
      entity:    'FinanceEntry',
      entityId:  e.id,
      newValue:  { type, amount: amount.toString(), category },
      meta:      { via: 'telegram' },
    })
    return e.autoId
  })

  await ctx.reply(`✓ ${autoId} — ${category} — ${amount.toString()} € сохранено.`)
}

// /invest — доинвестиция (REINVESTMENT). Другие типы (стартовые) вводятся только через веб.
export async function investConversation(conversation: Convo, ctx: MyContext) {
  const user = await requireLinked(conversation, ctx)
  if (!user) return
  if (!can(user, 'FINANCE', 'CREATE')) {
    await ctx.reply('Недостаточно прав для записи финансов.')
    return
  }

  const amount = await askAmount(conversation, ctx, 'Сумма доинвестиции?')
  if (amount === null) { await ctx.reply('Отменено.'); return }

  await ctx.reply('Источник / назначение? (можно пусто — точка). /cancel — отмена.')
  const msg = await conversation.waitFor('message:text')
  const sourceText = msg.message.text.trim()
  if (isCancel(sourceText)) { await ctx.reply('Отменено.'); return }
  const source = sourceText === '.' ? '' : sourceText

  const autoId = await conversation.external(async () => {
    const year  = new Date().getFullYear()
    const newId = await nextCapitalAutoId(user.companyId, year)
    const e = await prisma.capitalEntry.create({
      data: {
        companyId: user.companyId,
        autoId:    newId,
        type:      'REINVESTMENT',
        date:      new Date(),
        source,
        amount,
        note:      'Через Telegram-бота',
      },
    })
    await writeAudit({
      companyId: user.companyId,
      userId:    user.id,
      action:    'CREATE',
      entity:    'CapitalEntry',
      entityId:  e.id,
      newValue:  { amount: amount.toString(), source },
      meta:      { via: 'telegram' },
    })
    return e.autoId
  })

  await ctx.reply(`✓ ${autoId} — доинвестиция ${amount.toString()} € сохранена.`)
}

// /stock — списание или продажа со склада
export async function stockConversation(conversation: Convo, ctx: MyContext) {
  const user = await requireLinked(conversation, ctx)
  if (!user) return
  if (!can(user, 'INVENTORY', 'EDIT')) {
    await ctx.reply('Недостаточно прав для склада.')
    return
  }

  await ctx.reply('Поиск товара — введите название (или часть). /cancel — отмена.')
  // Decimal-поля не клонируются через structuredClone (см. комментарий ниже) —
  // сразу переводим их в строки, чтобы результат можно было безопасно вернуть из external().
  interface StockItemLite { id: string; name: string; unit: string; qtyInStock: string; sellPrice: string; qtyMinAlert: string }
  let items: StockItemLite[] = []
  for (;;) {
    const msg = await conversation.waitFor('message:text')
    const q = msg.message.text.trim()
    if (isCancel(q)) { await ctx.reply('Отменено.'); return }

    items = await conversation.external(async () => {
      const found = await prisma.inventoryItem.findMany({
        where: { companyId: user.companyId, active: true, name: { contains: q, mode: 'insensitive' } },
        take: 8,
      })
      return found.map((it) => ({
        id: it.id, name: it.name, unit: it.unit,
        qtyInStock:  it.qtyInStock.toString(),
        sellPrice:   it.sellPrice.toString(),
        qtyMinAlert: it.qtyMinAlert.toString(),
      }))
    })
    if (items.length === 0) {
      await ctx.reply('Ничего не найдено, попробуйте другой запрос.')
      continue
    }
    break
  }

  const list = items.map((it, i) => `${i + 1}. ${it.name} — в наличии ${it.qtyInStock.toString()} ${it.unit}`).join('\n')
  await ctx.reply(`${list}\n\nВыберите номер. /cancel — отмена.`)

  let item: typeof items[number] | undefined
  for (;;) {
    const msg = await conversation.waitFor('message:text')
    const text = msg.message.text.trim()
    if (isCancel(text)) { await ctx.reply('Отменено.'); return }
    const idx = parseInt(text, 10)
    if (!isNaN(idx) && items[idx - 1]) { item = items[idx - 1]; break }
    await ctx.reply('Некорректный номер, попробуйте ещё раз.')
  }
  if (!item) return

  await ctx.reply('Списание или продажа?\n1. Списание в работу\n2. Продажа\n\n/cancel — отмена.')
  let kind: 'WRITE_OFF' | 'SELL' | null = null
  for (;;) {
    const msg = await conversation.waitFor('message:text')
    const text = msg.message.text.trim()
    if (isCancel(text)) { await ctx.reply('Отменено.'); return }
    if (text === '1') { kind = 'WRITE_OFF'; break }
    if (text === '2') { kind = 'SELL'; break }
    await ctx.reply('Введите 1 или 2.')
  }

  const qty = await askAmount(conversation, ctx, `Количество (${item.unit})?`)
  if (qty === null) { await ctx.reply('Отменено.'); return }

  const unitPrice = kind === 'SELL' ? new Decimal(item.sellPrice.toString()) : new Decimal(0)

  // conversation.external() клонирует возвращаемое значение (structuredClone) —
  // Decimal-объекты и Prisma-модели не клонируются, возвращаем только примитивы.
  const result = await conversation.external(async () => {
    const currentStock = new Decimal(item!.qtyInStock.toString())
    const newStock      = Decimal.max(0, currentStock.minus(qty))
    const total          = qty.mul(unitPrice)
    const incomeAutoId   = kind === 'SELL' ? await nextFinanceAutoId(user.companyId, 'INCOME', new Date().getFullYear()) : ''

    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          companyId: user.companyId,
          itemId:    item!.id,
          type:      kind!,
          qty,
          unitPrice,
          total,
          note:      'Через Telegram-бота',
        },
      }),
      prisma.inventoryItem.update({
        where: { id: item!.id },
        data:  { qtyInStock: newStock },
      }),
      prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          userId:    user.id,
          action:    'STOCK_MOVE',
          entity:    'InventoryItem',
          entityId:  item!.id,
          oldValue:  { qtyInStock: item!.qtyInStock },
          newValue:  { type: kind, qty, newStock },
          meta:      { via: 'telegram' },
        },
      }),
      ...(kind === 'SELL'
        ? [prisma.financeEntry.create({
            data: {
              companyId:   user.companyId,
              autoId:      incomeAutoId,
              type:        'INCOME' as const,
              date:        new Date(),
              category:    'Продажа запчастей',
              amountExpr:  total.toString(),
              amount:      total,
              description: `Продажа: ${item!.name}`,
            },
          })]
        : []
      ),
    ])

    const lowStock = newStock.lt(new Decimal(item!.qtyMinAlert.toString()))
    return { newStock: newStock.toString(), lowStock }
  })

  await ctx.reply(
    `✓ ${kind === 'SELL' ? 'Продажа' : 'Списание'}: ${item.name} −${qty.toString()} ${item.unit}. ` +
    `Остаток: ${result.newStock} ${item.unit}.`,
  )

  if (result.lowStock) {
    await ctx.reply(`⚠ Остаток «${item.name}» ниже минимального (${item.qtyMinAlert.toString()} ${item.unit}).`)
    await notifyAdmins(user.companyId, `⚠ Низкий остаток: «${item.name}» — ${result.newStock} ${item.unit} (мин. ${item.qtyMinAlert.toString()}).`)
  }
}
