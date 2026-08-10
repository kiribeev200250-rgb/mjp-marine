import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { nextFinanceAutoId } from '@/lib/crm/numbering'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Каскад «фактура ↔ склад ↔ финансы»: события выставления/оплаты/отмены фактуры
// порождают цепочки изменений в связанных модулях. Каждая функция здесь — один
// шаг каскада, идемпотентна (безопасно не вызывать дважды на одном документе) и
// возвращает человекочитаемое резюме для UI ("что произошло").

interface JobWithMaterials {
  materials: { name: string; quantity: unknown; inventoryItemId: string | null }[]
}

// Списание материалов со склада при выставлении фактуры (создании или переводе
// черновика/пресмета в ISSUED). Материал без inventoryItemId (вписан вручную)
// склад не трогает. Нехватка остатка не блокирует — уходит в минус с пометкой.
export async function writeOffInvoiceMaterials(
  tx: Tx,
  companyId: string,
  invoice: { id: string; number: string },
  jobs: JobWithMaterials[],
): Promise<string[]> {
  // Идемпотентность: перепроверяем актуальный флаг внутри функции, а не только
  // полагаемся на дисциплину вызывающего кода — повторный вызов на одном и том
  // же счёте не должен списать материалы дважды.
  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { materialsWrittenOff: true } })
  if (current?.materialsWrittenOff) return []

  const lines: string[] = []
  const alerts: string[] = []

  for (const job of jobs) {
    for (const m of job.materials) {
      if (!m.inventoryItemId) continue
      const qty = new Decimal(String(m.quantity))
      if (qty.lte(0)) continue

      const item = await tx.inventoryItem.findUnique({ where: { id: m.inventoryItemId } })
      if (!item) continue

      const newStock = new Decimal(item.qtyInStock.toString()).minus(qty)

      await tx.stockMovement.create({
        data: {
          companyId,
          itemId:    item.id,
          invoiceId: invoice.id,
          type:      'WRITE_OFF',
          qty,
          unitPrice: item.costPrice,
          total:     qty.times(item.costPrice),
          note:      `Списание по счёту ${invoice.number}`,
        },
      })
      await tx.inventoryItem.update({ where: { id: item.id }, data: { qtyInStock: newStock } })

      let line = `${item.name} ×${qty.toString()} ${item.unit}`
      if (newStock.lt(0)) {
        line += ' — остаток ушёл в минус, дозакажите'
        alerts.push(`${item.name}: ${newStock.toString()} ${item.unit} (дефицит)`)
      } else if (item.qtyMinAlert.gt(0) && newStock.lt(new Decimal(item.qtyMinAlert.toString()))) {
        line += ' — ниже минимального остатка'
        alerts.push(`${item.name}: ${newStock.toString()} ${item.unit} (мин. ${item.qtyMinAlert.toString()})`)
      }
      lines.push(line)
    }
  }

  await tx.invoice.update({ where: { id: invoice.id }, data: { materialsWrittenOff: true } })

  if (alerts.length > 0) {
    void notifyAdmins(companyId, `⚠ Счёт ${invoice.number}: остаток ниже нормы —\n${alerts.join('\n')}`)
  }

  return lines
}

// Возврат материалов на склад при аннулировании фактуры — обратная операция
// к writeOffInvoiceMaterials. Использует тип RECEIVE (дельта +qty), а не ADJUST
// (у ADJUST в ручных движениях склада другая семантика — абсолютное значение).
export async function returnInvoiceMaterials(
  tx: Tx,
  companyId: string,
  invoice: { id: string; number: string },
): Promise<string[]> {
  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { materialsWrittenOff: true } })
  if (!current?.materialsWrittenOff) return []

  const movements = await tx.stockMovement.findMany({
    where:   { invoiceId: invoice.id, type: 'WRITE_OFF' },
    include: { item: true },
  })

  const lines: string[] = []
  for (const mv of movements) {
    const qty  = new Decimal(mv.qty.toString())
    const item = mv.item
    const newStock = new Decimal(item.qtyInStock.toString()).plus(qty)

    await tx.stockMovement.create({
      data: {
        companyId,
        itemId:    item.id,
        invoiceId: invoice.id,
        type:      'RECEIVE',
        qty,
        unitPrice: mv.unitPrice,
        total:     mv.total,
        note:      `Возврат по аннулированному счёту ${invoice.number}`,
      },
    })
    await tx.inventoryItem.update({ where: { id: item.id }, data: { qtyInStock: newStock } })
    lines.push(`${item.name} ×${qty.toString()} ${item.unit} — возвращено на склад`)
  }

  await tx.invoice.update({ where: { id: invoice.id }, data: { materialsWrittenOff: false } })
  return lines
}

// Оплата фактуры: доход в P&L/кассу, снятие с дебиторки, воронка → «Оплачено».
// Идемпотентно — повторный вызов на уже оплаченной фактуре ничего не делает.
export async function recordPayment(
  tx: Tx,
  companyId: string,
  invoice: { id: string; number: string; clientId: string; total: unknown; status: string; paymentMethod: string },
  paymentMethod?: string,
): Promise<string[]> {
  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { status: true } })
  if (current?.status === 'PAID') return []

  const year   = new Date().getFullYear()
  const autoId = await nextFinanceAutoId(companyId, 'INCOME', year)
  const amount = new Decimal(String(invoice.total))

  await tx.financeEntry.create({
    data: {
      companyId,
      autoId,
      type:          'INCOME',
      date:          new Date(),
      category:      'Оплата по счёту',
      amountExpr:    amount.toString(),
      amount,
      paymentMethod: invoice.paymentMethod || paymentMethod || '',
      description:   `Оплата счёта ${invoice.number}`,
      clientId:      invoice.clientId,
      invoiceId:     invoice.id,
    },
  })
  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { status: 'PAID', paidAt: new Date(), ...(paymentMethod && { paymentMethod }) },
  })
  await tx.client.update({ where: { id: invoice.clientId }, data: { funnelStage: 'PAID' } })
  await tx.funnelHistory.create({
    data: { clientId: invoice.clientId, fromStage: 'INVOICE_SENT', toStage: 'PAID', note: `Счёт ${invoice.number} оплачен` },
  })

  return [
    `Доход +${amount.toFixed(2)} € (${autoId}) зачислен в P&L и кассу`,
    `Счёт ${invoice.number} снят с дебиторки`,
    `Клиент переведён на стадию «Оплачено»`,
  ]
}

// Отмена оплаты: сторнирует связанный FinanceEntry (удаляет из P&L/кассы —
// снимок суммы сохраняется в аудит-логе), фактура снова «не оплачена».
export async function reversePayment(
  tx: Tx,
  companyId: string,
  userId: string | null | undefined,
  invoice: { id: string; number: string; clientId: string; status: string },
): Promise<string[]> {
  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { status: true } })
  if (current?.status !== 'PAID') return []

  const lines: string[] = []
  const entry = await tx.financeEntry.findFirst({ where: { invoiceId: invoice.id, type: 'INCOME' } })
  if (entry) {
    await tx.auditLog.create({
      data: {
        companyId,
        userId: userId ?? undefined,
        action: 'DELETE',
        entity: 'FinanceEntry',
        entityId: entry.id,
        oldValue: { autoId: entry.autoId, amount: entry.amount.toString() },
        meta: { reason: 'unpay-invoice', invoiceId: invoice.id },
      },
    })
    await tx.financeEntry.delete({ where: { id: entry.id } })
    lines.push(`Доход ${entry.autoId} на ${new Decimal(entry.amount.toString()).toFixed(2)} € удалён из P&L и кассы`)
  }

  await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'ISSUED', paidAt: null } })
  await tx.client.update({ where: { id: invoice.clientId }, data: { funnelStage: 'INVOICE_SENT' } })
  await tx.funnelHistory.create({
    data: { clientId: invoice.clientId, fromStage: 'PAID', toStage: 'INVOICE_SENT', note: `Оплата счёта ${invoice.number} отменена` },
  })
  lines.push(`Счёт ${invoice.number} снова в дебиторке`)

  return lines
}
