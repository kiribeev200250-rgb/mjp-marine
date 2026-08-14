import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { nextFinanceAutoId } from '@/lib/crm/numbering'
import { findOrCreateCategory } from '@/lib/crm/services/categories'
import { recordVat } from '@/lib/crm/services/vat'

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
  // Отдельные бакеты: уход в минус (списано больше, чем физически было — сбой
  // учёта, а не просто "пора дозаказать") vs обычное "ниже точки заказа".
  // Разный тон алерта — иначе владелец привыкает игнорировать оба как одно.
  const negativeAlerts: string[] = []
  const lowStockAlerts: string[] = []

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
      if (newStock.isNegative()) {
        line += ' — остаток ушёл в минус, списано больше, чем было в наличии'
        negativeAlerts.push(`${item.name}: ${newStock.toString()} ${item.unit}`)
      } else if (item.qtyMinAlert.gt(0) && newStock.lt(new Decimal(item.qtyMinAlert.toString()))) {
        line += ' — ниже минимального остатка'
        lowStockAlerts.push(`${item.name}: ${newStock.toString()} ${item.unit} (мин. ${item.qtyMinAlert.toString()})`)
      }
      lines.push(line)
    }
  }

  await tx.invoice.update({ where: { id: invoice.id }, data: { materialsWrittenOff: true } })

  if (negativeAlerts.length > 0) {
    void notifyAdmins(companyId, `🔴 Счёт ${invoice.number}: остаток ушёл в минус — проверьте склад —\n${negativeAlerts.join('\n')}`)
  }
  if (lowStockAlerts.length > 0) {
    void notifyAdmins(companyId, `⚠ Счёт ${invoice.number}: остаток ниже нормы —\n${lowStockAlerts.join('\n')}`)
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

// Оплата фактуры (полная — доплата остатка): доход в P&L/кассу, снятие с
// дебиторки, воронка → «Оплачено». Идемпотентно — повторный вызов на уже
// оплаченной фактуре ничего не делает.
//
// Платит именно ОСТАТОК (subtotal минус уже зачтённый нетто-доход по этому
// счёту), а не всегда полный subtotal — так одна и та же функция корректно
// закрывает и обычную оплату (остаток = вся сумма, ничего раньше не платили),
// и финальную доплату после аванса (см. recordDeposit ниже), без отдельной
// функции и без риска задвоить уже зачтённый аванс.
//
// IVA не деньги компании — в P&L идёт только база (нетто). Полная сумма
// (нетто+IVA) физически приходит на счёт (касса это видит через IVA repercutido,
// см. ниже), но доходом/прибылью считается только нетто. IRPF (если есть) клиент
// удерживает и платит в Hacienda сам — эти деньги в кассу вообще не попадают,
// поэтому кассовые формулы (dashboard/finance/reports-pl) отдельно вычитают
// Σ invoice.irpfAmount по оплаченным счетам.
export async function recordPayment(
  tx: Tx,
  companyId: string,
  invoice: {
    id: string; number: string; clientId: string; status: string; paymentMethod: string
    subtotal: unknown; ivaAmount: unknown; ivaRate: unknown
  },
  paymentMethod?: string,
): Promise<string[]> {
  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { status: true } })
  if (current?.status === 'PAID') return []

  const fullNet = new Decimal(String(invoice.subtotal))
  const ivaRate = new Decimal(String(invoice.ivaRate))
  const paidEntries = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
  const paidNet = paidEntries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const remainingNet = fullNet.minus(paidNet)

  const now = new Date()
  const lines: string[] = []

  // Остаток уже покрыт (напр. авансом на всю сумму) — новую запись не создаём,
  // только закрываем статус, чтобы не задвоить доход.
  if (remainingNet.gt(0)) {
    const year   = now.getFullYear()
    const autoId = await nextFinanceAutoId(tx, companyId, 'INCOME', year)
    const remainingIva = remainingNet.times(ivaRate).div(100).toDecimalPlaces(2)
    const category = await findOrCreateCategory(tx, companyId, 'INCOME', 'Работы по фактуре')

    const entry = await tx.financeEntry.create({
      data: {
        companyId,
        autoId,
        type:          'INCOME',
        date:          now,
        category:      category.name,
        categoryId:    category.id,
        amountExpr:    remainingNet.toString(),
        amount:        remainingNet,
        paymentMethod: invoice.paymentMethod || paymentMethod || '',
        description:   paidNet.gt(0) ? `Доплата остатка по счёту ${invoice.number}` : `Оплата счёта ${invoice.number}`,
        clientId:      invoice.clientId,
        invoiceId:     invoice.id,
      },
    })

    await recordVat(tx, companyId, {
      direction:      'REPERCUTIDO',
      date:           now,
      baseAmount:     remainingNet,
      rate:           ivaRate,
      amount:         remainingIva,
      invoiceId:      invoice.id,
      financeEntryId: entry.id,
      note:           `Счёт ${invoice.number}`,
    })

    lines.push(`Доход +${remainingNet.toFixed(2)} € (${autoId}) зачислен в P&L — это нетто, без IVA`)
  }

  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { status: 'PAID', paidAt: now, ...(paymentMethod && { paymentMethod }) },
  })
  await tx.client.update({ where: { id: invoice.clientId }, data: { funnelStage: 'PAID' } })
  await tx.funnelHistory.create({
    data: { clientId: invoice.clientId, fromStage: 'INVOICE_SENT', toStage: 'PAID', note: `Счёт ${invoice.number} оплачен` },
  })

  lines.push(`Счёт ${invoice.number} снят с дебиторки`, `Клиент переведён на стадию «Оплачено»`)

  const netAmount = fullNet // для итоговой строки ниже (полная сумма/IVA счёта, не только последний платёж)
  const ivaAmount = new Decimal(String(invoice.ivaAmount))
  const grossReceived = netAmount.plus(ivaAmount)
  if (ivaAmount.gt(0)) {
    lines.push(`На счёт поступило ${grossReceived.toFixed(2)} € (нетто ${netAmount.toFixed(2)} € + IVA ${ivaAmount.toFixed(2)} €) — IVA отложен как repercutido, не прибыль`)
  }
  return lines
}

// Аванс/предоплата — частичная оплата ДО или В МОМЕНТ выставления (не после,
// как recordPayment/обычный поток). depositGrossAmount — сумма, которую
// клиент реально внёс (брутто, с IVA — так её и озвучивают клиенту: «внесите
// 30% сейчас»), а не депонированное поле Invoice.depositValue (то —
// информационное, «сколько попросить», не движение денег). Тот же паттерн
// разбивки нетто/IVA, что и в recordPayment; счёт уходит в PARTIAL (или сразу
// в PAID, если аванс = 100% остатка) — тот же статус, что и «оплатили, потом
// частично вернули», потому что оба означают одно и то же для дебиторки:
// «оплачено не всё». Финальная доплата — обычный recordPayment (платит
// остаток, не задваивает аванс).
export async function recordDeposit(
  tx: Tx,
  companyId: string,
  invoice: { id: string; number: string; clientId: string; ivaRate: unknown },
  depositGrossAmount: Decimal,
  paymentMethod?: string,
): Promise<string[]> {
  if (depositGrossAmount.lte(0)) throw new Error('Сумма аванса должна быть больше нуля')

  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { status: true, subtotal: true } })
  if (!current) throw new Error('Счёт не найден')
  if (current.status === 'PAID' || current.status === 'CANCELLED') {
    throw new Error('По этому счёту нельзя внести аванс — счёт уже закрыт')
  }

  const ivaRate = new Decimal(String(invoice.ivaRate))
  const netPortion = depositGrossAmount.div(ivaRate.div(100).plus(1)).toDecimalPlaces(2)
  const ivaPortion = depositGrossAmount.minus(netPortion)

  const paidEntries = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
  const paidNet = paidEntries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  const fullNet = new Decimal(current.subtotal.toString())
  if (paidNet.plus(netPortion).gt(fullNet)) {
    throw new Error('Аванс превышает остаток по счёту')
  }

  const now  = new Date()
  const year = now.getFullYear()
  const autoId = await nextFinanceAutoId(tx, companyId, 'INCOME', year)
  const category = await findOrCreateCategory(tx, companyId, 'INCOME', 'Аванс по счёту')

  const entry = await tx.financeEntry.create({
    data: {
      companyId,
      autoId,
      type:          'INCOME',
      date:          now,
      category:      category.name,
      categoryId:    category.id,
      amountExpr:    netPortion.toString(),
      amount:        netPortion,
      paymentMethod: paymentMethod ?? '',
      description:   `Аванс по счёту ${invoice.number}`,
      clientId:      invoice.clientId,
      invoiceId:     invoice.id,
    },
  })

  await recordVat(tx, companyId, {
    direction:      'REPERCUTIDO',
    date:           now,
    baseAmount:     netPortion,
    rate:           ivaRate,
    amount:         ivaPortion,
    invoiceId:      invoice.id,
    financeEntryId: entry.id,
    note:           `Аванс по счёту ${invoice.number}`,
  })

  const fullyCovered = paidNet.plus(netPortion).gte(fullNet)
  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { status: fullyCovered ? 'PAID' : 'PARTIAL', ...(fullyCovered && { paidAt: now }) },
  })

  const lines = [
    `Аванс +${netPortion.toFixed(2)} € (${autoId}) зачислен в P&L — это нетто, без IVA`,
    `Остаток по счёту ${invoice.number}: ${fullNet.minus(paidNet).minus(netPortion).toFixed(2)} € (нетто)`,
  ]
  if (fullyCovered) lines.push(`Аванс покрыл всю сумму — счёт переведён в «Оплачено»`)
  return lines
}

// Возврат (полный/частичный) уже проведённой оплаты — сторно-запись, а не
// удаление: создаёт обратную FinanceEntry (тот же type INCOME, отрицательная
// amount, reversalOfId → исходный платёж) и обратную VatEntry (repercutido,
// пропорционально ставке IVA счёта), поэтому вся история остаётся видна и
// раскрываема (drill-down), а не пропадает бесследно. Идемпотентно в том
// смысле, что нельзя вернуть больше, чем реально зачислено по счёту сейчас
// (с учётом уже сделанных ранее возвратов) — повторный вызов с той же суммой,
// если она уже возвращена, будет отклонён валидацией на превышение.
export async function refundPayment(
  tx: Tx,
  companyId: string,
  userId: string | null | undefined,
  invoice: { id: string; number: string; clientId: string; ivaRate: unknown },
  netRefundAmount: Decimal,
  reason?: string,
): Promise<string[]> {
  if (netRefundAmount.lte(0)) throw new Error('Сумма возврата должна быть больше нуля')

  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { status: true } })
  if (current?.status !== 'PAID' && current?.status !== 'PARTIAL') {
    throw new Error('По этому счёту нет проведённой оплаты для возврата')
  }

  const paidEntries = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
  const paidNet = paidEntries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  if (netRefundAmount.gt(paidNet)) {
    throw new Error(`Сумма возврата (${netRefundAmount.toFixed(2)} €) превышает оплаченную часть (${paidNet.toFixed(2)} €)`)
  }

  const ivaRate   = new Decimal(String(invoice.ivaRate))
  const ivaRefund = netRefundAmount.times(ivaRate).div(100).toDecimalPlaces(2)
  const grossRefund = netRefundAmount.plus(ivaRefund)

  const year   = new Date().getFullYear()
  const autoId = await nextFinanceAutoId(tx, companyId, 'INCOME', year)
  const category = await findOrCreateCategory(tx, companyId, 'INCOME', 'Работы по фактуре')
  const now = new Date()

  const originalPayment = await tx.financeEntry.findFirst({
    where:   { invoiceId: invoice.id, type: 'INCOME', amount: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  })

  const entry = await tx.financeEntry.create({
    data: {
      companyId,
      autoId,
      type:        'INCOME',
      date:        now,
      category:    category.name,
      categoryId:  category.id,
      amountExpr:  netRefundAmount.negated().toString(),
      amount:      netRefundAmount.negated(),
      description: `Возврат по счёту ${invoice.number}${reason ? ' — ' + reason : ''}`,
      clientId:    invoice.clientId,
      invoiceId:   invoice.id,
      reversalOfId: originalPayment?.id,
    },
  })

  await recordVat(tx, companyId, {
    direction:      'REPERCUTIDO',
    date:           now,
    baseAmount:     netRefundAmount.negated(),
    rate:           ivaRate,
    amount:         ivaRefund.negated(),
    invoiceId:      invoice.id,
    financeEntryId: entry.id,
    note:           `Возврат по счёту ${invoice.number}`,
  })

  const newPaidNet   = paidNet.minus(netRefundAmount)
  const fullyRefunded = newPaidNet.lte(0)
  const newStatus     = fullyRefunded ? 'ISSUED' : 'PARTIAL'

  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { status: newStatus, ...(fullyRefunded && { paidAt: null }) },
  })

  await tx.auditLog.create({
    data: {
      companyId,
      userId: userId ?? undefined,
      action: 'REFUND',
      entity: 'FinanceEntry',
      entityId: entry.id,
      oldValue: { paidNetBefore: paidNet.toString() },
      newValue: { autoId, amount: entry.amount.toString(), ivaRefund: ivaRefund.toString(), reason: reason ?? '' },
      meta: { invoiceId: invoice.id, reversalOfId: originalPayment?.id },
    },
  })

  const lines = [
    `Возврат ${netRefundAmount.toFixed(2)} € по счёту ${invoice.number} (${autoId}): доход −${netRefundAmount.toFixed(2)}, IVA repercutido −${ivaRefund.toFixed(2)}`,
    `Клиенту к возврату ${grossRefund.toFixed(2)} € (нетто + IVA)`,
  ]

  if (fullyRefunded) {
    await tx.client.update({ where: { id: invoice.clientId }, data: { funnelStage: 'INVOICE_SENT' } })
    await tx.funnelHistory.create({
      data: { clientId: invoice.clientId, fromStage: 'PAID', toStage: 'INVOICE_SENT', note: `Оплата счёта ${invoice.number} полностью возвращена` },
    })
    lines.push(`Счёт ${invoice.number} снова в дебиторке — полностью не оплачен`)
  } else {
    lines.push(`Счёт ${invoice.number} переведён в «Частично оплачен» — остаток ${newPaidNet.toFixed(2)} € (нетто) зачтён`)
  }

  return lines
}

// Отмена оплаты (полный возврат): сторнирует весь зачтённый по счёту доход —
// тонкая обёртка над refundPayment на всю оставшуюся сумму. Идемпотентно —
// повторный вызов на уже неоплаченном счёте ничего не делает.
export async function reversePayment(
  tx: Tx,
  companyId: string,
  userId: string | null | undefined,
  invoice: { id: string; number: string; clientId: string; status: string; ivaRate: unknown },
): Promise<string[]> {
  const current = await tx.invoice.findUnique({ where: { id: invoice.id }, select: { status: true } })
  if (current?.status !== 'PAID' && current?.status !== 'PARTIAL') return []

  const paidEntries = await tx.financeEntry.findMany({ where: { invoiceId: invoice.id, type: 'INCOME' } })
  const paidNet = paidEntries.reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
  if (paidNet.lte(0)) return []

  return refundPayment(tx, companyId, userId, invoice, paidNet, 'Полная отмена оплаты')
}
