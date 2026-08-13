import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'

// DELETE — удалить заметку (опечатка/ошибка)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'CLIENTS', 'DELETE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const existing = await prisma.note.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.note.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
