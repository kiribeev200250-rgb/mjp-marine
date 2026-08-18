import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { moveProjectWorksToQuote } from '@/lib/crm/services/projects'
import { prisma } from '@/lib/prisma'

// POST /api/crm/projects/[id]/works/transfer-to-quote — выбранные работы
// проекта → новый пресмет. В отличие от переноса в счёт, работы ОСТАЮТСЯ в
// проекте (пресмет — предложение, не обязательство; можно пересобрать и
// отправить клиенту ещё раз позже). Требует И право на проект (PROJECTS.EDIT),
// И право на пресметы (INVOICES.CREATE), т.к. затрагивает оба модуля — та же
// логика, что и transfer-to-invoice.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав на создание пресметов' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { workIds, ivaRate, language, validUntil } = body as {
    workIds?: string[]
    ivaRate?: string | number
    language?: string
    validUntil?: string | null
  }

  if (!Array.isArray(workIds) || workIds.length === 0) {
    return NextResponse.json({ error: 'Выберите хотя бы одну работу' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction((tx) =>
      moveProjectWorksToQuote(tx, session.user.companyId, session.user.id, projectId, workIds, {
        ivaRate, language, validUntil,
      }),
    )
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
