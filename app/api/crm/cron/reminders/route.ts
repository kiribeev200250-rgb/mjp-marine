import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegram, notifyAdmins } from '@/lib/crm/telegram/notify'
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

  const results = { digests: 0, overdue: 0, lowStock: 0 }

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

  // 2. Просроченные счета — переводим в OVERDUE и уведомляем админов компании
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: { in: ['ISSUED', 'PARTIAL'] }, dueDate: { lt: start } },
  })
  const overdueByCompany = new Map<string, typeof overdueInvoices>()
  for (const inv of overdueInvoices) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } })
    if (!overdueByCompany.has(inv.companyId)) overdueByCompany.set(inv.companyId, [])
    overdueByCompany.get(inv.companyId)!.push(inv)
    results.overdue++
  }
  for (const [companyId, invoices] of overdueByCompany) {
    const list = invoices.map((i) => `${i.number} — ${i.clientName} — ${formatMoney(i.total)} (срок ${i.dueDate ? fmtDate(i.dueDate) : '—'})`).join('\n')
    await notifyAdmins(companyId, `🔴 Просроченные счета:\n${list}`)
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

  return NextResponse.json({ ok: true, ...results })
}
