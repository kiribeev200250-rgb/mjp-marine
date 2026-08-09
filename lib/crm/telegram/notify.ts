import { prisma } from '@/lib/prisma'
import { getBot } from './bot'

// Проактивная отправка сообщений (вне ответа на входящее обновление) —
// используется из cron и из веб-роутов (напр. алерт низкого остатка при списании).
export async function sendTelegram(telegramId: string, text: string): Promise<void> {
  const bot = getBot()
  if (!bot) return
  try {
    await bot.api.sendMessage(telegramId, text)
  } catch (e) {
    console.error('[telegram] Не удалось отправить сообщение', telegramId, e)
  }
}

export async function notifyAdmins(companyId: string, text: string): Promise<void> {
  const admins = await prisma.crmUser.findMany({
    where: { companyId, role: 'ADMIN', active: true, telegramId: { not: null } },
    select: { telegramId: true },
  })
  await Promise.all(admins.map((a) => sendTelegram(a.telegramId!, text)))
}
