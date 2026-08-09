import { Bot, session } from 'grammy'
import { conversations, createConversation } from '@grammyjs/conversations'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/crm/audit'
import { TASK_STATUS_LABELS } from '@/lib/crm/utils'
import { prismaStorage } from './session-storage'
import { getLinkedUser, can } from './auth'
import { parseTaskStatus } from './status'
import { moneyEntryConversation, investConversation, stockConversation } from './conversations'
import type { MyContext, TaskListEntry } from './types'

let bot: Bot<MyContext> | null = null
let initialized = false

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
  initialized = true
  return bot
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function registerCommands(bot: Bot<MyContext>) {
  bot.command('start', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '')
    const user = await getLinkedUser(telegramId)
    if (user) {
      await ctx.reply(`С возвращением, ${user.name}!\n\n/today — задачи на сегодня\n/task <текст> — в бэклог\n/status <№> <статус> — сменить статус\n/expense /income /invest /stock — записи\n\nФото чека — просто пришлите фото.`)
    } else {
      await ctx.reply('Привет! Аккаунт ещё не привязан.\nЗайдите в CRM → Настройки → ваш профиль, получите код и отправьте: /link <код>')
    }
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
