import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// GET /api/crm/suppliers — список поставщиков
export async function GET() {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const suppliers = await prisma.supplier.findMany({
    where:   { companyId: session.user.companyId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { items: true, bills: true } } },
  })
  return NextResponse.json(suppliers)
}

// POST /api/crm/suppliers — создать поставщика
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, contactName, phone, email, notes } = body as {
    name?: string; contactName?: string; phone?: string; email?: string; notes?: string
  }
  if (!name?.trim()) return NextResponse.json({ error: 'Укажите название поставщика' }, { status: 400 })

  const exists = await prisma.supplier.findFirst({ where: { companyId: session.user.companyId, name: name.trim() } })
  if (exists) return NextResponse.json({ error: 'Поставщик с таким названием уже есть' }, { status: 400 })

  const supplier = await prisma.supplier.create({
    data: {
      companyId:   session.user.companyId,
      name:        name.trim(),
      contactName: contactName?.trim() ?? '',
      phone:       phone?.trim() ?? '',
      email:       email?.trim() ?? '',
      notes:       notes?.trim() ?? '',
    },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id,
    action: 'CREATE', entity: 'Supplier', entityId: supplier.id, newValue: { name: supplier.name },
  })

  return NextResponse.json(supplier, { status: 201 })
}
