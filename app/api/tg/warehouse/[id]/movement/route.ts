import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getTgSession } from '@/lib/crm/telegram/webapp-auth'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { recordStockFinanceEntry } from '@/lib/crm/services/stockFinance'
import { prisma } from '@/lib/prisma'
import type { StockMovementType } from '@prisma/client'

const VALID_TYPES: StockMovementType[] = ['RECEIVE', 'WRITE_OFF', 'SELL']

// POST /api/tg/warehouse/[id]/movement — приход/списание/продажа из Mini App
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params
  const session = await getTgSession(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.role, session.permissions, 'INVENTORY', 'EDIT')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { type, qty } = await req.json() as { type: StockMovementType; qty: string | number }
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Некорректный тип движения' }, { status: 400 })

  const qtyDec = new Decimal(qty || 0)
  if (qtyDec.lte(0)) return NextResponse.json({ error: 'Количество должно быть > 0' }, { status: 400 })

  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, companyId: session.companyId, active: true } })
  if (!item) return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })

  const currentStock = new Decimal(item.qtyInStock.toString())
  const newStock = type === 'RECEIVE' ? currentStock.plus(qtyDec) : Decimal.max(0, currentStock.minus(qtyDec))
  const unitPrice = type === 'SELL' ? new Decimal(item.sellPrice.toString()) : new Decimal(item.costPrice.toString())
  const total = qtyDec.mul(unitPrice)

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: { companyId: session.companyId, itemId, type, qty: qtyDec, unitPrice, total, note: 'Через Telegram Mini App' },
    })
    await tx.inventoryItem.update({ where: { id: itemId }, data: { qtyInStock: newStock } })
    if (type === 'RECEIVE' || type === 'SELL') {
      await recordStockFinanceEntry(tx, session.companyId, item, type, total)
    }
  })

  await writeAudit({
    companyId: session.companyId, userId: session.id, action: 'STOCK_MOVE',
    entity: 'InventoryItem', entityId: itemId,
    oldValue: { qtyInStock: item.qtyInStock }, newValue: { type, qty: qtyDec.toString(), newStock: newStock.toString() },
    meta: { via: 'telegram_miniapp' },
  })

  const minAlert = new Decimal(item.qtyMinAlert.toString())
  if (type !== 'RECEIVE' && minAlert.gt(0) && newStock.lt(minAlert)) {
    void notifyAdmins(session.companyId, `⚠ Низкий остаток: «${item.name}» — ${newStock.toString()} ${item.unit} (мин. ${minAlert.toString()}).`)
  }

  return NextResponse.json({ ok: true, newStock: newStock.toString() })
}
