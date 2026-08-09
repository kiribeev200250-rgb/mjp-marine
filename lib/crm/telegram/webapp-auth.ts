import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { PermissionMatrix } from '@/lib/crm/permissions'
import { getCrmSession } from '@/lib/crm/session'

export interface TgWebAppUser { id: number; first_name: string; last_name?: string; username?: string }

// Валидация initData от Telegram Mini App — см.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
// ok, если HEX(HMAC_SHA256(data_check_string, secret_key)) === hash
export function verifyTelegramInitData(initData: string, maxAgeSec = 86400): TgWebAppUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken || !initData) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(computedHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  const authDate = Number(params.get('auth_date') ?? 0)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null

  const userJson = params.get('user')
  if (!userJson) return null
  try {
    return JSON.parse(userJson) as TgWebAppUser
  } catch {
    return null
  }
}

export interface TgSessionUser {
  id:          string
  companyId:   string
  role:        'ADMIN' | 'EMPLOYEE'
  permissions: PermissionMatrix
  name:        string
  telegramId?: string
}

// Единая сессия для /api/tg/**: сначала пробуем Telegram initData (заголовок
// X-Telegram-Init-Data — так работает настоящий Mini App внутри Telegram),
// затем — обычную CRM-сессию NextAuth (чтобы можно было открыть /tg в обычном
// браузере залогиненным CRM-пользователем — используется для разработки/теста
// без публичного HTTPS-URL, который Telegram обязателен для реального Mini App).
export async function getTgSession(req: Request): Promise<TgSessionUser | null> {
  const initData = req.headers.get('x-telegram-init-data')
  if (initData) {
    const tgUser = verifyTelegramInitData(initData)
    if (tgUser) {
      const user = await prisma.crmUser.findUnique({ where: { telegramId: String(tgUser.id) } })
      if (user && user.active) {
        return {
          id: user.id, companyId: user.companyId, role: user.role,
          permissions: user.permissions as PermissionMatrix, name: user.name,
          telegramId: user.telegramId ?? undefined,
        }
      }
      return null // валидный Telegram-пользователь, но аккаунт не привязан
    }
  }

  const crmSession = await getCrmSession()
  if (crmSession) {
    return {
      id: crmSession.user.id, companyId: crmSession.user.companyId, role: crmSession.user.role,
      permissions: crmSession.user.permissions, name: crmSession.user.name,
    }
  }

  return null
}
