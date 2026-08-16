import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { moveProjectWorksToInvoice } from '@/lib/crm/services/projects'
import { prisma } from '@/lib/prisma'

// POST /api/crm/projects/[id]/works/transfer-to-invoice — выбранные работы
// проекта → новый счёт. Работа при этом ПОКИДАЕТ активный список проекта
// (status MOVED_TO_INVOICE) — не задвоится при повторном переносе. Требует
// И право на проект (PROJECTS.EDIT — переносим работы), И право на счета
// (INVOICES.CREATE — реально создаём фискальный документ), т.к. затрагивает
// оба модуля.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав на создание счетов' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { workIds, ivaRate, irpfRate, paymentMethod, language, dueDate, clientNif, clientAddress, asDraft } = body as {
    workIds?: string[]
    ivaRate?: string | number
    irpfRate?: string | number
    paymentMethod?: string
    language?: string
    dueDate?: string | null
    clientNif?: string
    clientAddress?: string
    asDraft?: boolean
  }

  if (!Array.isArray(workIds) || workIds.length === 0) {
    return NextResponse.json({ error: 'Выберите хотя бы одну работу' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction((tx) =>
      moveProjectWorksToInvoice(tx, session.user.companyId, session.user.id, projectId, workIds, {
        ivaRate, irpfRate, paymentMethod, language, dueDate, clientNif, clientAddress, asDraft,
      }),
    )
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, { status: 400 })
  }
}
