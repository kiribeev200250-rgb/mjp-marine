import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegram, notifyAdmins } from '@/lib/crm/telegram/notify'
import { sendOverdueInvoiceEmail } from '@/lib/resend'
import { formatMoney } from '@/lib/crm/utils'

export const runtime = 'nodejs'
export const maxDuration = 60

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(d)
}

// GET /api/crm/cron/reminders — ежедневный дайджест (Vercel Cron, см. vercel.json).
// Утренний дайджест задач + просрочка счетов + низкий остаток склада.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
  }

  const results = { digests: 0, overdue: 0, overdueClientEmails: 0, overdueClientEmailFailures: 0, lowStock: 0, seasonalReminders: 0 }

  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end   = new Date(); end.setHours(23, 59, 59, 999)

  // 1. Утренний дайджест задач — каждому привязанному сотруднику с задачами на сегодня
  const users = await prisma.crmUser.findMany({
    where: { active: true, telegramId: { not: null } },
  })
  for (const user of users) {
    const tasks = await prisma.task.findMany({
      where: { companyId: user.companyId, assigneeId: user.id, scheduledAt: { gte: start, lte: end } },
      orderBy: { scheduledAt: 'asc' },
    })
    if (tasks.length === 0) continue
    const list = tasks.map((t, i) =>
      `${i + 1}. ${t.scheduledAt ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(t.scheduledAt) : '—'} · ${t.title}${t.marina ? ` · ${t.marina}` : ''}`,
    ).join('\n')
    await sendTelegram(user.telegramId!, `☀️ Доброе утро! Задачи на сегодня:\n${list}`)
    results.digests++
  }

  // 2. Просроченные счета — переводим в OVERDUE, уведомляем админов компании
  // и (если у клиента есть email) шлём ему вежливое напоминание. Без PDF-
  // вложения и без ссылки на счёт — см. комментарий у sendOverdueInvoiceEmail.
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: { in: ['ISSUED', 'PARTIAL'] }, dueDate: { lt: start } },
    include: { client: { select: { email: true, language: true } } },
  })
  const overdueByCompany = new Map<string, typeof overdueInvoices>()
  const emailFailuresByCompany = new Map<string, string[]>()
  for (const inv of overdueInvoices) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } })
    if (!overdueByCompany.has(inv.companyId)) overdueByCompany.set(inv.companyId, [])
    overdueByCompany.get(inv.companyId)!.push(inv)
    results.overdue++

    if (inv.client.email) {
      try {
        await sendOverdueInvoiceEmail({
          to: inv.client.email,
          clientName: inv.clientName,
          number: inv.number,
          totalFormatted: formatMoney(inv.total),
          dueDateFormatted: inv.dueDate ? fmtDate(inv.dueDate) : '—',
          language: inv.client.language || inv.language,
        })
        results.overdueClientEmails++
        await prisma.invoice.update({ where: { id: inv.id }, data: { lastEmailSentAt: new Date(), lastEmailError: null } })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[cron/reminders] Не удалось отправить письмо клиенту', inv.id, e)
        await prisma.invoice.update({ where: { id: inv.id }, data: { lastEmailError: message } })
        results.overdueClientEmailFailures++
        if (!emailFailuresByCompany.has(inv.companyId)) emailFailuresByCompany.set(inv.companyId, [])
        emailFailuresByCompany.get(inv.companyId)!.push(`${inv.number} — ${inv.clientName}`)
      }
    }
  }
  for (const [companyId, invoices] of overdueByCompany) {
    const list = invoices.map((i) => `${i.number} — ${i.clientName} — ${formatMoney(i.total)} (срок ${i.dueDate ? fmtDate(i.dueDate) : '—'})`).join('\n')
    await notifyAdmins(companyId, `🔴 Просроченные счета:\n${list}`)
  }
  // Живой канал-фолбэк: если письмо клиенту не ушло (напр. домен отправки не
  // верифицирован в Resend), владелец не должен узнавать об этом только из
  // логов Vercel — Telegram уже работает, используем его как запасной канал.
  for (const [companyId, failed] of emailFailuresByCompany) {
    await notifyAdmins(companyId, `✉️⚠ Не удалось отправить письмо-напоминание клиенту по ${failed.length} счёт(ам):\n${failed.join('\n')}\n\nПроверьте настройки отправки почты (Resend).`)
  }

  // 3. Низкий остаток склада — по компаниям
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: { active: true, qtyMinAlert: { gt: 0 } },
  })
  const lowByCompany = new Map<string, typeof lowStockItems>()
  for (const item of lowStockItems) {
    if (Number(item.qtyInStock) < Number(item.qtyMinAlert)) {
      if (!lowByCompany.has(item.companyId)) lowByCompany.set(item.companyId, [])
      lowByCompany.get(item.companyId)!.push(item)
      results.lowStock++
    }
  }
  for (const [companyId, items] of lowByCompany) {
    const list = items.map((it) => `${it.name} — ${it.qtyInStock.toString()} ${it.unit} (мин. ${it.qtyMinAlert.toString()})`).join('\n')
    await notifyAdmins(companyId, `⚠ Низкий остаток на складе:\n${list}`)
  }

  // 4. Сезонные напоминания (ТО и т.п.) — созревшие Reminder(SEASONAL_SERVICE)
  // превращаются в новую задачу-бэклог для того же клиента, владелец
  // уведомляется. sent=true ставится сразу после создания задачи — не
  // раньше, чтобы сбой на полпути не «съел» напоминание молча.
  const dueReminders = await prisma.reminder.findMany({
    where: { type: 'SEASONAL_SERVICE', sent: false, scheduledAt: { lte: end } },
  })
  for (const reminder of dueReminders) {
    const task = await prisma.task.create({
      data: {
        companyId: reminder.companyId,
        title: reminder.title,
        clientId: reminder.clientId,
        isBacklog: true,
        status: 'NEW',
      },
    })
    await prisma.reminder.update({ where: { id: reminder.id }, data: { sent: true, sentAt: new Date() } })
    await prisma.auditLog.create({
      data: {
        companyId: reminder.companyId, action: 'CREATE', entity: 'Task', entityId: task.id,
        newValue: { title: reminder.title }, meta: { via: 'cron_seasonal_reminder', reminderId: reminder.id },
      },
    })
    await notifyAdmins(reminder.companyId, `🔔 Сезонное напоминание: «${reminder.title}» → добавлено в бэклог`)
    results.seasonalReminders++
  }

  return NextResponse.json({ ok: true, ...results })
}
