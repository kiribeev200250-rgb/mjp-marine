import { NextResponse } from 'next/server'
import { getTgSession, verifyTelegramInitData } from '@/lib/crm/telegram/webapp-auth'
import { prisma } from '@/lib/prisma'

// GET /api/tg/session — кто сейчас смотрит Mini App (или почему не пускаем)
export async function GET(req: Request) {
  const session = await getTgSession(req)

  if (session) {
    const company = await prisma.company.findFirst({ where: { id: session.companyId }, select: { name: true } })
    return NextResponse.json({
      linked: true,
      user: { name: session.name, role: session.role },
      companyName: company?.name ?? 'MJP Marine',
    })
  }

  // Настоящий Telegram-пользователь, но его аккаунт ещё не привязан к CRM
  const initData = req.headers.get('x-telegram-init-data')
  const tgUser = initData ? verifyTelegramInitData(initData) : null

  return NextResponse.json({ linked: false, telegram: !!tgUser })
}
