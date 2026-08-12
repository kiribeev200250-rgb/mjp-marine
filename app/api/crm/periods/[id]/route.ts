import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

// DELETE /api/crm/periods/[id] — открыть период обратно. Только ADMIN.
// Не предусмотрено спецификацией явно, но без этого администратор не сможет
// исправить случайно закрытый период — оставлено как контролируемый и
// аудируемый предохранитель.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Открывать период может только администратор' }, { status: 403 })
  }

  const existing = await prisma.periodLock.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.$transaction([
    prisma.periodLock.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'DELETE',
        entity:    'PeriodLock',
        entityId:  id,
        oldValue:  { label: existing.label, startDate: existing.startDate, endDate: existing.endDate },
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
