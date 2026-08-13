import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'

// POST /api/crm/notes — добавить датированную заметку к клиенту или к лодке
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'CLIENTS', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const body = await req.json()
  const { clientId, boatId, text } = body as { clientId?: string; boatId?: string; text?: string }

  if (!clientId && !boatId) return NextResponse.json({ error: 'Не указан клиент или лодка' }, { status: 400 })
  if (!text?.trim()) return NextResponse.json({ error: 'Текст заметки пуст' }, { status: 400 })

  if (boatId) {
    const boat = await prisma.yacht.findFirst({ where: { id: boatId, client: { companyId: session.user.companyId } } })
    if (!boat) return NextResponse.json({ error: 'Лодка не найдена' }, { status: 404 })
  } else if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId: session.user.companyId } })
    if (!client) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
  }

  const note = await prisma.note.create({
    data: {
      companyId: session.user.companyId,
      clientId:  boatId ? null : (clientId ?? null),
      boatId:    boatId ?? null,
      authorId:  session.user.id,
      text:      text.trim(),
    },
    include: { author: { select: { name: true } } },
  })

  return NextResponse.json(note, { status: 201 })
}
