import { NextResponse } from 'next/server'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'INVENTORY', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()

  const items = await prisma.inventoryItem.findMany({
    where: {
      companyId: session.companyId, active: true,
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
    },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, unit: true, qtyInStock: true, qtyMinAlert: true, sellPrice: true, costPrice: true },
  })

  return NextResponse.json(items.map((i) => ({
    id: i.id, name: i.name, unit: i.unit,
    qtyInStock: i.qtyInStock.toString(), qtyMinAlert: i.qtyMinAlert.toString(),
    sellPrice: i.sellPrice.toString(), costPrice: i.costPrice.toString(),
    lowStock: Number(i.qtyMinAlert) > 0 && Number(i.qtyInStock) < Number(i.qtyMinAlert),
  })))
}
