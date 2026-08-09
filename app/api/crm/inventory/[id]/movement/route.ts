import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import Decimal from 'decimal.js'
import type { StockMovementType } from '@prisma/client'

type Ctx = { params: Promise<{ id: string }> }

const VALID_TYPES: StockMovementType[] = ['RECEIVE', 'WRITE_OFF', 'ADJUST', 'ORDER', 'SELL']

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: itemId } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'EDIT')

  const body = await req.json()
  const { type, qty, unitPrice, taskId, note } = body

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Некорректный тип движения' }, { status: 400 })
  }

  const qtyDec   = new Decimal(String(qty || 0))
  const priceDec = new Decimal(String(unitPrice || 0))

  if (qtyDec.lte(0) && type !== 'ADJUST') {
    return NextResponse.json({ error: 'Количество должно быть > 0' }, { status: 400 })
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, companyId: session.user.companyId, active: true },
  })
  if (!item) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })

  // Calculate new stock quantities
  const currentStock   = new Decimal(item.qtyInStock.toString())
  const currentOrdered = new Decimal(item.qtyOrdered.toString())

  let newStock   = currentStock
  let newOrdered = currentOrdered

  if (type === 'RECEIVE') {
    newStock   = currentStock.plus(qtyDec)
    newOrdered = Decimal.max(0, currentOrdered.minus(qtyDec))
  } else if (type === 'WRITE_OFF' || type === 'SELL') {
    newStock = Decimal.max(0, currentStock.minus(qtyDec))
  } else if (type === 'ADJUST') {
    const adjustDec = new Decimal(String(qty))   // can be 0
    newStock = adjustDec.gte(0) ? adjustDec : currentStock
  } else if (type === 'ORDER') {
    newOrdered = currentOrdered.plus(qtyDec)
  }

  const total = type !== 'ORDER' ? qtyDec.abs().mul(priceDec) : new Decimal(0)

  // Продажа со склада создаёт доход автоматически (см. SPEC М3)
  const incomeAutoId = type === 'SELL'
    ? await nextFinanceAutoId(session.user.companyId, 'INCOME', new Date().getFullYear())
    : null

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        companyId: session.user.companyId,
        itemId,
        type,
        qty:       qtyDec,
        unitPrice: priceDec,
        total,
        note:      note?.trim() ?? '',
        ...(taskId && { taskId }),
      },
    }),
    prisma.inventoryItem.update({
      where: { id: itemId },
      data:  { qtyInStock: newStock, qtyOrdered: newOrdered },
    }),
    prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'STOCK_MOVE',
        entity:    'InventoryItem',
        entityId:  itemId,
        oldValue:  { qtyInStock: item.qtyInStock },
        newValue:  { type, qty: qtyDec, newStock },
        meta:      { note },
      },
    }),
    ...(type === 'SELL'
      ? [prisma.financeEntry.create({
          data: {
            companyId:   session.user.companyId,
            autoId:      incomeAutoId!,
            type:        'INCOME' as const,
            date:        new Date(),
            category:    'Продажа запчастей',
            amountExpr:  total.toString(),
            amount:      total,
            description: `Продажа: ${item.name}`,
          },
        })]
      : []
    ),
  ])

  // Уведомление в Telegram, если списание/продажа увели остаток ниже минимума
  if ((type === 'WRITE_OFF' || type === 'SELL') && item.qtyMinAlert.toString() !== '0' && newStock.lt(new Decimal(item.qtyMinAlert.toString()))) {
    void notifyAdmins(
      session.user.companyId,
      `⚠ Низкий остаток: «${item.name}» — ${newStock.toString()} ${item.unit} (мин. ${item.qtyMinAlert.toString()}).`,
    )
  }

  return NextResponse.json(movement, { status: 201 })
}