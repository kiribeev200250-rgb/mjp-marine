import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { findActivePeriodLock } from '@/lib/crm/periodLock'

type Ctx = { params: Promise<{ id: string }> }

// Тип и сумма проведённого вложения никогда не редактируются напрямую — ошибку
// (напр. STARTUP_ASSET вместо REINVESTMENT, или неверную сумму) чинит только
// сторно (см. reverse/route.ts) + новая корректная запись. Метаданные (источник,
// заметка, дата) можно править, пока период не закрыт.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'EDIT')

  const existing = await prisma.capitalEntry.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await req.json()
  const { type, amount, source, date, note } = body

  if (type != null || amount != null) {
    return NextResponse.json(
      { error: 'Тип и сумма вложения не редактируются напрямую — используйте сторно' },
      { status: 400 },
    )
  }

  const lock = await findActivePeriodLock(session.user.companyId, existing.date)
  if (lock) {
    return NextResponse.json(
      { error: `Период «${lock.label}» закрыт — правка запрещена. Исправление — сторно новой записью в открытом периоде` },
      { status: 403 },
    )
  }

  let newDate = existing.date
  if (date != null) {
    newDate = new Date(date)
    if (isNaN(newDate.getTime())) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
    const targetLock = await findActivePeriodLock(session.user.companyId, newDate)
    if (targetLock) {
      return NextResponse.json({ error: `Период «${targetLock.label}» закрыт — нельзя перенести запись туда` }, { status: 403 })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.capitalEntry.update({
      where: { id },
      data: {
        ...(source != null && { source: String(source).trim() }),
        ...(date   != null && { date: newDate }),
        ...(note   != null && { note: String(note).trim() }),
      },
    })

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'UPDATE',
        entity:    'CapitalEntry',
        entityId:  id,
        oldValue:  { source: existing.source, date: existing.date, note: existing.note },
        newValue:  body,
      },
    })

    return u
  })

  return NextResponse.json(updated)
}

// Вложения никогда не удаляются — только сторнируются (см. reverse/route.ts),
// чтобы касса и история капитала оставались согласованы и проверяемы.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'DELETE')

  const existing = await prisma.capitalEntry.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  return NextResponse.json(
    { error: 'Вложения не удаляются — используйте сторно' },
    { status: 400 },
  )
}
