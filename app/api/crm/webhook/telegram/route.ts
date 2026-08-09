import { NextResponse } from 'next/server'
import { webhookCallback } from 'grammy'
import { getBot } from '@/lib/crm/telegram/bot'

export const runtime = 'nodejs'

// POST /api/crm/webhook/telegram — принимает апдейты от Telegram.
// Если TELEGRAM_BOT_TOKEN не задан, бот отключён — отвечаем 200 и ничего не делаем
// (как и остальные опциональные интеграции в проекте, см. FB webhook).
export async function POST(req: Request) {
  const bot = getBot()
  if (!bot) return NextResponse.json({ ok: true })

  const handler = webhookCallback(bot, 'std/http', undefined, undefined, process.env.TELEGRAM_WEBHOOK_SECRET)
  return handler(req)
}
