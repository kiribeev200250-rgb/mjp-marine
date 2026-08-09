import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')

  const item = await prisma.inventoryItem.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: {
      movements: {
        orderBy: { createdAt: 'desc' },
        take:    50,
        include: { task: { select: { id: true, title: true } } },
      },
    },
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'EDIT')

  const body = await req.json()
  const { name, category, unit, qtyMinAlert, costPrice, sellPrice, supplier, notes } = body

  const existing = await prisma.inventoryItem.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data:  {
      ...(name        != null && { name:        name.trim() }),
      ...(category    != null && { category:    category.trim() }),
      ...(unit        != null && { unit:        unit.trim() || 'шт' }),
      ...(qtyMinAlert != null && { qtyMinAlert: Number(qtyMinAlert) }),
      ...(costPrice   != null && { costPrice:   Number(costPrice)   }),
      ...(sellPrice   != null && { sellPrice:   Number(sellPrice)   }),
      ...(supplier    != null && { supplier:    supplier.trim()     }),
      ...(notes       != null && { notes:       notes.trim()        }),
    },
  })

  await prisma.auditLog.create({
    data: {
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'UPDATE',
      entity:    'InventoryItem',
      entityId:  id,
      oldValue:  { name: existing.name, qtyMinAlert: existing.qtyMinAlert },
      newValue:  body,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'DELETE')

  await prisma.inventoryItem.update({ where: { id }, data: { active: false } })

  await prisma.auditLog.create({
    data: {
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'DELETE',
      entity:    'InventoryItem',
      entityId:  id,
    },
  })

  return NextResponse.json({ ok: true })
}