import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// DELETE /api/crm/invoices/[id]/purge — безвозвратное удаление счёта.
//
// СТРОГО только для DRAFT — у черновика ещё нет присвоенного сквозного номера
// (year/sequenceNum остаются null, см. схему), поэтому его исчезновение не
// оставляет дыру в фискальной нумерации. Любому счёту с уже присвоенным
// номером (ISSUED/PARTIAL/PAID/OVERDUE/CANCELLED) — отказ: единственный
// легальный способ «убрать» такой счёт — аннулирование через
// DELETE /api/crm/invoices/[id], которое переводит в CANCELLED, сторнирует
// зачтённую оплату и возвращает материалы на склад, но НЕ трогает номер и
// оставляет полный след в аудит-логе. См. испанское требование непрерывной
// нумерации фактур — раньше эта проверка отсутствовала (аудит нашёл дыру).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Удалять счета безвозвратно может только администратор' }, { status: 403 })
  }

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  if (existing.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Счёт с номером нельзя удалить безвозвратно — только аннулировать (перевести в статус «Отменён»)' },
      { status: 403 },
    )
  }

  await prisma.invoice.delete({ where: { id } })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'DELETE',
    entity:    'Invoice',
    entityId:  id,
    oldValue:  { number: existing.number, status: existing.status, total: existing.total.toString() },
    meta:      { via: 'purge', draft: true },
  })

  return NextResponse.json({ ok: true })
}
