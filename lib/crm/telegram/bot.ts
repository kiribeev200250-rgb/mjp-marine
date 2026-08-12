import { Bot, session, InlineKeyboard, GrammyError, HttpError } from 'grammy'
import { conversations, createConversation } from '@grammyjs/conversations'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/crm/audit'
import { TASK_STATUS_LABELS, formatMoney } from '@/lib/crm/utils'
import { recordPayment } from '@/lib/crm/services/invoiceCascade'
import { outstandingBalances } from '@/lib/crm/services/ar'
import { prismaStorage } from './session-storage'
import { getLinkedUser, can } from './auth'
import { parseTaskStatus } from './status'
import { moneyEntryConversation, investConversation, stockConversation } from './conversations'
import type { MyContext, TaskListEntry, InvoiceListEntry } from './types'

let bot: Bot<MyContext> | null = null
let initialized = false

function miniAppUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL
  if (!base || !base.startsWith('https://')) return null // web_app-кнопка требует https — на localhost её просто не показываем
  return `${base}/tg`
}

// Ленивая инициализация — чтобы отсутствие TELEGRAM_BOT_TOKEN не ломало сборку/остальной API.
export function getBot(): Bot<MyContext> | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  if (bot && initialized) return bot

  bot = new Bot<MyContext>(token)
  bot.use(session({ initial: (): MyContext['session'] => ({}), storage: prismaStorage() }))
  bot.use(conversations())
  bot.use(createConversation(moneyEntryConversation, 'expense'))
  bot.use(createConversation(moneyEntryConversation, 'income'))
  bot.use(createConversation(investConversation, 'invest'))
  bot.use(createConversation(stockConversation, 'stock'))

  registerCommands(bot)

  // Без этого необработанная ошибка в любом хендлере уходит в необработанный
  // reject: апдейт просто "теряется" молча, бот выглядит сломанным, но ни в
  // одном логе ничего нет. Логируем и по возможности отвечаем пользователю.
  bot.catch((err) => {
    const { ctx, error } = err
    const desc = error instanceof GrammyError ? `GrammyError: ${error.description}`
      : error instanceof HttpError ? `HttpError: ${error.message}`
      : error instanceof Error ? error.message
      : String(error)
    console.error(`[telegram] Ошибка обработки апдейта ${ctx.update.update_id}:`, desc)
    ctx.reply('Произошла ошибка. Попробуйте ещё раз или /cancel, если застряли в диалоге.').catch(() => {})
  })

  initialized = true
  return bot
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

async function sendInvoiceList(ctx: MyContext, user: { id: string; companyId: string }) {
  const invoices = await prisma.invoice.findMany({
    where: { companyId: user.companyId, status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
    orderBy: [{ dueDate: 'asc' }, { date: 'asc' }],
  })

  if (invoices.length === 0) {
    await ctx.reply('Неоплаченных счетов нет.')
    ctx.session.lastInvoiceList = []
    return
  }

  const list: InvoiceListEntry[] = invoices.map((inv, i) => ({ index: i + 1, id: inv.id, number: inv.number }))
  ctx.session.lastInvoiceList = list

  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const remaining = await outstandingBalances(invoices)
  const total = invoices.reduce((s, inv) => s.plus(remaining.get(inv.id)!), new Decimal(0))
  const text = invoices.map((inv, i) =>
    `${i + 1}. ${inv.number} · ${inv.clientName} · ${formatMoney(remaining.get(inv.id)!)}`,
  ).join('\n')

  await ctx.reply(`Неоплаченные счета (всего ${formatMoney(total)}):\n${text}\n\n/pay <№> — отметить оплаченным`)
}

const HELP_TEXT =
  '/today — задачи на сегодня\n' +
  '/task <текст> — быстро в бэклог\n' +
  '/status <№> <статус> — сменить статус (после /today)\n' +
  '/add — быстрая операция (меню)\n' +
  '/expense, /income, /invest, /stock — записи по шагам\n' +
  '/invoices — неоплаченные счета\n' +
  '/pay <№> — отметить счёт оплаченным (после /invoices)\n' +
  '/cancel — отменить текущий диалог\n' +
  '/help — эта справка\n\n' +
  'Фото чека — просто пришлите фото, оформим как расход.'

function registerCommands(bot: Bot<MyContext>) {
  bot.command('start', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    const url = miniAppUrl()
    const keyboard = url ? new InlineKeyboard().webApp('📱 Открыть приложение', url) : undefined

    if (user) {
      await ctx.reply(`С возвращением, ${user.name}!\n\n${HELP_TEXT}`, { reply_markup: keyboard })
    } else {
      await ctx.reply(
        'Привет! Аккаунт ещё не привязан.\nЗайдите в CRM → Настройки → ваш профиль, получите код и отправьте: /link <код>',
        { reply_markup: keyboard },
      )
    }
  })

  bot.command('help', async (ctx) => {
    const url = miniAppUrl()
    const keyboard = url ? new InlineKeyboard().webApp('📱 Открыть приложение', url) : undefined
    await ctx.reply(HELP_TEXT, { reply_markup: keyboard })
  })

  // Быстрое меню операций — аналог кнопки «+ Операция» в вебе.
  bot.command('add', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }

    const keyboard = new InlineKeyboard()
      .text('💸 Расход', 'add:expense').text('💰 Доход', 'add:income').row()
      .text('📈 Доинвестиция', 'add:invest').text('📦 Склад', 'add:stock').row()
      .text('🗓 Задача', 'add:task').text('🧾 Счета', 'add:invoices')

    await ctx.reply('Что добавляем?', { reply_markup: keyboard })
  })

  bot.callbackQuery('add:expense',  async (ctx) => { await ctx.answerCallbackQuery(); await ctx.conversation.enter('expense', { type: 'EXPENSE' }) })
  bot.callbackQuery('add:income',   async (ctx) => { await ctx.answerCallbackQuery(); await ctx.conversation.enter('income',  { type: 'INCOME'  }) })
  bot.callbackQuery('add:invest',   async (ctx) => { await ctx.answerCallbackQuery(); await ctx.conversation.enter('invest') })
  bot.callbackQuery('add:stock',    async (ctx) => { await ctx.answerCallbackQuery(); await ctx.conversation.enter('stock') })
  bot.callbackQuery('add:invoices', async (ctx) => {
    await ctx.answerCallbackQuery()
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'INVOICES', 'VIEW')) { await ctx.reply('Недостаточно прав.'); return }
    await sendInvoiceList(ctx, user)
  })
  bot.callbackQuery('add:task', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.reply('Отправьте: /task Текст задачи')
  })

  bot.command('link', async (ctx) => {
    const code = (ctx.match ?? '').toString().trim()
    if (!code) {
      await ctx.reply('Отправьте /link <код> — код возьмите в CRM → Настройки → ваш профиль.')
      return
    }
    const telegramId = String(ctx.from?.id ?? '')
    const candidate = await prisma.crmUser.findUnique({ where: { telegramLinkCode: code } })
    if (!candidate || !candidate.telegramLinkExpiresAt || candidate.telegramLinkExpiresAt < new Date()) {
      await ctx.reply('Код неверный или истёк. Получите новый в CRM → Настройки.')
      return
    }
    const taken = await prisma.crmUser.findUnique({ where: { telegramId } })
    if (taken && taken.id !== candidate.id) {
      await ctx.reply('Этот Telegram-аккаунт уже привязан к другому пользователю CRM.')
      return
    }

    await prisma.crmUser.update({
      where: { id: candidate.id },
      data:  { telegramId, telegramLinkCode: null, telegramLinkExpiresAt: null },
    })
    await writeAudit({
      companyId: candidate.companyId,
      userId:    candidate.id,
      action:    'UPDATE',
      entity:    'CrmUser',
      entityId:  candidate.id,
      meta:      { action: 'telegram_linked' },
    })
    await ctx.reply(`Готово, ${candidate.name}! Аккаунт привязан. Отправьте /start для списка команд.`)
  })

  bot.command('today', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'SCHEDULE', 'VIEW')) { await ctx.reply('Недостаточно прав.'); return }

    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)

    const tasks = await prisma.task.findMany({
      where: {
        companyId: user.companyId,
        assigneeId: user.id,
        scheduledAt: { gte: start, lte: end },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    if (tasks.length === 0) {
      await ctx.reply('На сегодня задач нет.')
      ctx.session.lastTaskList = []
      return
    }

    const list: TaskListEntry[] = tasks.map((t, i) => ({ index: i + 1, id: t.id, title: t.title }))
    ctx.session.lastTaskList = list

    const text = tasks.map((t, i) =>
      `${i + 1}. ${t.scheduledAt ? fmtDate(t.scheduledAt) : '—'} · ${t.title} · [${TASK_STATUS_LABELS[t.status]}]${t.marina ? ` · ${t.marina}` : ''}`,
    ).join('\n')

    await ctx.reply(`Задачи на сегодня:\n${text}\n\n/status <№> <статус> — сменить статус`)
  })

  bot.command('task', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'SCHEDULE', 'CREATE')) { await ctx.reply('Недостаточно прав.'); return }

    const title = (ctx.match ?? '').toString().trim()
    if (!title) { await ctx.reply('Использование: /task Текст задачи'); return }

    const task = await prisma.task.create({
      data: {
        companyId:  user.companyId,
        title,
        assigneeId: user.id,
        isBacklog:  true,
        status:     'NEW',
      },
    })
    await writeAudit({
      companyId: user.companyId, userId: user.id, action: 'CREATE', entity: 'Task', entityId: task.id,
      newValue: { title }, meta: { via: 'telegram' },
    })
    await ctx.reply(`✓ Добавлено в бэклог: «${title}»`)
  })

  bot.command('status', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'SCHEDULE', 'EDIT')) { await ctx.reply('Недостаточно прав.'); return }

    const parts = (ctx.match ?? '').toString().trim().split(/\s+/)
    if (parts.length < 2) { await ctx.reply('Использование: /status <№ из /today> <статус>\nСтатусы: новая, план, работа, готово, проблема'); return }

    const [numStr, ...statusParts] = parts
    const idx = parseInt(numStr, 10)
    const status = parseTaskStatus(statusParts.join(' '))

    if (!status) { await ctx.reply('Не распознал статус. Варианты: новая, план, работа, готово, проблема'); return }

    const entry = ctx.session.lastTaskList?.find((t) => t.index === idx)
    if (!entry) { await ctx.reply('Сначала вызовите /today, затем ссылайтесь на номер из списка.'); return }

    const task = await prisma.task.findFirst({ where: { id: entry.id, companyId: user.companyId } })
    if (!task) { await ctx.reply('Задача не найдена.'); return }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data:  { status, ...(status === 'DONE' && { completedAt: new Date() }) },
    })
    await writeAudit({
      companyId: user.companyId, userId: user.id, action: 'STATUS_CHANGE', entity: 'Task', entityId: task.id,
      oldValue: { status: task.status }, newValue: { status }, meta: { via: 'telegram' },
    })
    await ctx.reply(`✓ «${updated.title}» → ${TASK_STATUS_LABELS[status]}`)
  })

  bot.command('expense', (ctx) => ctx.conversation.enter('expense', { type: 'EXPENSE' }))
  bot.command('income',  (ctx) => ctx.conversation.enter('income',  { type: 'INCOME'  }))
  bot.command('invest',  (ctx) => ctx.conversation.enter('invest'))
  bot.command('stock',   (ctx) => ctx.conversation.enter('stock'))

  bot.command('invoices', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'INVOICES', 'VIEW')) { await ctx.reply('Недостаточно прав.'); return }
    await sendInvoiceList(ctx, user)
  })

  bot.command('pay', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'INVOICES', 'EDIT')) { await ctx.reply('Недостаточно прав.'); return }

    const idx = parseInt((ctx.match ?? '').toString().trim(), 10)
    const entry = ctx.session.lastInvoiceList?.find((i) => i.index === idx)
    if (!entry) { await ctx.reply('Использование: /pay <№ из /invoices>'); return }

    const invoice = await prisma.invoice.findFirst({ where: { id: entry.id, companyId: user.companyId } })
    if (!invoice) { await ctx.reply('Счёт не найден.'); return }
    if (invoice.status === 'PAID') { await ctx.reply(`Счёт ${invoice.number} уже оплачен.`); return }
    if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
      await ctx.reply(`Счёт ${invoice.number} нельзя отметить оплаченным (статус: ${invoice.status}).`); return
    }

    try {
      const lines = await prisma.$transaction(async (tx) => {
        const cascade = await recordPayment(tx, user.companyId, invoice)
        await tx.auditLog.create({
          data: {
            companyId: user.companyId, userId: user.id, action: 'STATUS_CHANGE',
            entity: 'Invoice', entityId: invoice.id,
            oldValue: { status: invoice.status }, newValue: { status: 'PAID' },
            meta: { cascade, via: 'telegram' },
          },
        })
        return cascade
      })
      await ctx.reply(`✓ ${invoice.number} оплачен:\n${lines.join('\n')}`)
    } catch (e) {
      await ctx.reply(`Не удалось провести оплату: ${e instanceof Error ? e.message : 'ошибка сервера'}`)
    }
  })

  bot.command('cancel', async (ctx) => {
    await ctx.conversation.exitAll()
    await ctx.reply('Отменено.')
  })

  // Фото чека → сразу в сценарий /expense с прикреплённой ссылкой на фото.
  // ВРЕМЕННО: ссылка ведёт на Telegram CDN, а не Google Drive (SA credentials
  // ещё не подключены — см. заметку в CLAUDE.md по Этапу 7/5).
  bot.on('message:photo', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (!user) { await ctx.reply('Сначала привяжите аккаунт: /link <код>'); return }
    if (!can(user, 'FINANCE', 'CREATE')) { await ctx.reply('Недостаточно прав.'); return }

    const photos = ctx.message.photo
    const largest = photos[photos.length - 1]
    const file = await ctx.api.getFile(largest.file_id)
    const receiptUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    await ctx.reply('Фото получено — оформим как расход.')
    await ctx.conversation.enter('expense', { type: 'EXPENSE', receiptUrl })
  })

  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      await ctx.reply('Неизвестная команда. /start — список команд.')
    }
  })
}
