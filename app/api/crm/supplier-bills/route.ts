import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// GET /api/crm/supplier-bills — список заказов у поставщиков (кредиторка)
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const status = req.nextUrl.searchParams.get('status')

  const bills = await prisma.supplierBill.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status && { status: status as 'ORDERED' | 'RECEIVED' | 'PAID' | 'CANCELLED' }),
    },
    orderBy: { orderedAt: 'desc' },
    include: {
      supplier: { select: { id: true, name: true } },
      task:     { select: { id: true, title: true } },
      client:   { select: { id: true, firstName: true, lastName: true } },
      item:     { select: { id: true, name: true, unit: true } },
    },
    take: 200,
  })
  return NextResponse.json(bills)
}

// POST /api/crm/supplier-bills — «заказано у поставщика под задачу/клиента,
// ждём поставки». Если привязано к позиции склада — сразу создаёт
// StockMovement(ORDER), тот же тип, что и ручной заказ в InventoryTable, —
// qtyOrdered растёт сразу, приёмка (см. .../receive) спишет его в приход.
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVENTORY', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    supplierId, taskId, clientId, itemId, description, qty, amount, hasVat, vatRate,
  } = body as {
    supplierId?: string; taskId?: string; clientId?: string; itemId?: string
    description?: string; qty?: string | number; amount?: string | number
    hasVat?: boolean; vatRate?: string | number
  }

  if (!supplierId) return NextResponse.json({ error: 'Выберите поставщика' }, { status: 400 })
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId: session.user.companyId } })
  if (!supplier) return NextResponse.json({ error: 'Поставщик не найден' }, { status: 404 })

  if (!description?.trim()) return NextResponse.json({ error: 'Укажите описание заказа' }, { status: 400 })

  let amountDec: Decimal
  let qtyDec: Decimal
  try {
    amountDec = new Decimal(String(amount ?? '0'))
    if (amountDec.lte(0)) throw new Error('Сумма должна быть > 0')
    qtyDec = new Decimal(String(qty ?? '1'))
    if (qtyDec.lte(0)) throw new Error('Количество должно быть > 0')
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректные данные' }, { status: 400 })
  }

  let item = null
  if (itemId) {
    item = await prisma.inventoryItem.findFirst({ where: { id: itemId, companyId: session.user.companyId } })
    if (!item) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })
  }

  const withVat = !!hasVat
  const rate = withVat ? new Decimal(String(vatRate ?? 21)) : new Decimal(0)
  if (rate.lt(0) || rate.gt(100)) return NextResponse.json({ error: 'Ставка IVA должна быть от 0 до 100%' }, { status: 400 })
  const vatAmount = withVat ? amountDec.times(rate).div(100).toDecimalPlaces(2) : new Decimal(0)
  const total = amountDec.plus(vatAmount)

  const bill = await prisma.$transaction(async (tx) => {
    const b = await tx.supplierBill.create({
      data: {
        companyId: session.user.companyId,
        supplierId, taskId: taskId || null, clientId: clientId || null, itemId: itemId || null,
        description: description.trim(), qty: qtyDec, amount: amountDec,
        hasVat: withVat, vatRate: rate, vatAmount, total,
      },
    })

    if (item) {
      const newOrdered = new Decimal(item.qtyOrdered.toString()).plus(qtyDec)
      await tx.stockMovement.create({
        data: {
          companyId: session.user.companyId, itemId: item.id, type: 'ORDER',
          qty: qtyDec, unitPrice: amountDec.div(qtyDec).toDecimalPlaces(2), total: amountDec,
          note: `Заказано у поставщика ${supplier.name}`,
        },
      })
      await tx.inventoryItem.update({ where: { id: item.id }, data: { qtyOrdered: newOrdered } })
    }

    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId, userId: session.user.id,
        action: 'CREATE', entity: 'SupplierBill', entityId: b.id,
        newValue: { supplier: supplier.name, amount: amountDec.toString(), description: b.description },
      },
    })

    return b
  })

  return NextResponse.json(bill, { status: 201 })
}
