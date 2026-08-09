import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'

export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')

  const { searchParams } = req.nextUrl
  const q        = searchParams.get('q')?.trim()
  const category = searchParams.get('category')
  const lowStock = searchParams.get('lowStock') === '1'

  const items = await prisma.inventoryItem.findMany({
    where: {
      companyId: session.user.companyId,
      active:    true,
      ...(category && { category }),
      ...(q && {
        OR: [
          { name:     { contains: q, mode: 'insensitive' } },
          { supplier: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  const result = lowStock
    ? items.filter((i) => Number(i.qtyMinAlert) > 0 && Number(i.qtyInStock) < Number(i.qtyMinAlert))
    : items

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'CREATE')

  const body = await req.json()
  const { name, category, unit, qtyInStock, qtyMinAlert, costPrice, sellPrice, supplier, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const item = await prisma.inventoryItem.create({
    data: {
      companyId:   session.user.companyId,
      name:        name.trim(),
      category:    category?.trim() ?? '',
      unit:        unit?.trim() || 'шт',
      qtyInStock:  Number(qtyInStock) || 0,
      qtyMinAlert: Number(qtyMinAlert) || 0,
      costPrice:   Number(costPrice) || 0,
      sellPrice:   Number(sellPrice) || 0,
      supplier:    supplier?.trim() ?? '',
      notes:       notes?.trim() ?? '',
    },
  })

  await prisma.auditLog.create({
    data: {
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'CREATE',
      entity:    'InventoryItem',
      entityId:  item.id,
      newValue:  { name: item.name, qtyInStock: item.qtyInStock },
    },
  })

  return NextResponse.json(item, { status: 201 })
}