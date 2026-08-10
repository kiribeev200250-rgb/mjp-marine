import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { CategoryKind } from '@prisma/client'

const VALID_KINDS: CategoryKind[] = ['INCOME', 'EXPENSE', 'SALARY']

// GET /api/crm/categories?kind=EXPENSE — растущий список категорий (без архивных)
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  const kind = req.nextUrl.searchParams.get('kind') as CategoryKind | null
  if (kind && !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Некорректный тип категории' }, { status: 400 })
  }

  const categories = await prisma.category.findMany({
    where:   { companyId: session.user.companyId, archived: false, ...(kind && { kind }) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(categories)
}

// POST /api/crm/categories — создать категорию «на лету» (идемпотентно: та же
// пара kind+name возвращает существующую, а не дублирует).
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')

  const body = await req.json()
  const { kind, name } = body as { kind?: CategoryKind; name?: string }

  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Некорректный тип категории' }, { status: 400 })
  }
  const trimmed = name?.trim()
  if (!trimmed) return NextResponse.json({ error: 'Укажите название категории' }, { status: 400 })

  const existing = await prisma.category.findUnique({
    where: { companyId_kind_name: { companyId: session.user.companyId, kind, name: trimmed } },
  })
  if (existing) {
    // Категория уже была — если архивная, разархивируем (пользователь явно её выбрал).
    if (existing.archived) {
      const revived = await prisma.category.update({ where: { id: existing.id }, data: { archived: false } })
      return NextResponse.json(revived)
    }
    return NextResponse.json(existing)
  }

  const maxOrder = await prisma.category.aggregate({
    where: { companyId: session.user.companyId, kind },
    _max:  { sortOrder: true },
  })

  const category = await prisma.category.create({
    data: {
      companyId: session.user.companyId,
      kind,
      name:      trimmed,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'CREATE',
    entity:    'Category',
    entityId:  category.id,
    newValue:  { kind, name: trimmed },
  })

  return NextResponse.json(category, { status: 201 })
}
