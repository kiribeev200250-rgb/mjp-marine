import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// POST — сгенерировать код привязки Telegram для сотрудника (действует 15 минут)
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const { userId } = await req.json()
  const user = await prisma.crmUser.findFirst({ where: { id: userId, companyId: session.user.companyId } })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  const code      = String(randomInt(100000, 1000000))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.crmUser.update({
    where: { id: userId },
    data:  { telegramLinkCode: code, telegramLinkExpiresAt: expiresAt },
  })

  return NextResponse.json({ code, expiresAt })
}

// DELETE — отвязать Telegram
export async function DELETE(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const { userId } = await req.json()
  const user = await prisma.crmUser.findFirst({ where: { id: userId, companyId: session.user.companyId } })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  await prisma.crmUser.update({
    where: { id: userId },
    data:  { telegramId: null, telegramLinkCode: null, telegramLinkExpiresAt: null },
  })
  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'CrmUser', entityId: userId, meta: { action: 'telegram_unlinked' },
  })

  return NextResponse.json({ ok: true })
}
