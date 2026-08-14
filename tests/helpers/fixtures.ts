import type { Prisma, FunnelStage } from '@prisma/client'
import Decimal from 'decimal.js'

// Минимальные throwaway-фикстуры для тестов денежных каскадов. Создаются
// ВНУТРИ той же транзакции, что и сам тест (см. withRollback) — при откате
// исчезают вместе со всем остальным, отдельной уборки не требуется.

export async function makeCompany(tx: Prisma.TransactionClient, opts?: { ivaRate?: number; irpfRate?: number }) {
  const company = await tx.company.create({ data: { name: 'TEST company (rollback)' } })
  await tx.companyInfo.create({
    data: {
      companyId: company.id,
      ivaRate:  new Decimal(opts?.ivaRate  ?? 21),
      irpfRate: new Decimal(opts?.irpfRate ?? 0),
    },
  })
  return company.id
}

export async function makeClient(tx: Prisma.TransactionClient, companyId: string, opts?: { funnelStage?: FunnelStage }) {
  const client = await tx.client.create({
    data: {
      companyId,
      firstName: 'Test',
      lastName:  'Client',
      ...(opts?.funnelStage && { funnelStage: opts.funnelStage }),
    },
  })
  return client.id
}

interface MakeInvoiceOpts {
  status?:   'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  subtotal:  number
  ivaRate?:  number
  irpfRate?: number
  number?:   string
}

// subtotal — нетто (база). ivaAmount/total считаются от ivaRate/irpfRate так
// же, как это делает документConstructor — не дублирует бизнес-логику, просто
// готовит согласованные исходные данные для теста каскада, который САМ эту
// логику проверяет (recordPayment и т.п.), а не пересчитывает.
export async function makeInvoice(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientId: string,
  opts: MakeInvoiceOpts,
) {
  const subtotal = new Decimal(opts.subtotal)
  const ivaRate  = new Decimal(opts.ivaRate  ?? 21)
  const irpfRate = new Decimal(opts.irpfRate ?? 0)
  const ivaAmount  = subtotal.times(ivaRate).div(100).toDecimalPlaces(2)
  const irpfAmount = subtotal.times(irpfRate).div(100).toDecimalPlaces(2)
  const total = subtotal.plus(ivaAmount).minus(irpfAmount)

  const invoice = await tx.invoice.create({
    data: {
      companyId,
      clientId,
      number: opts.number ?? `TEST-${Date.now()}`,
      status: opts.status ?? 'ISSUED',
      ivaRate, irpfRate,
      jobsTotal: subtotal, materialsTotal: 0, subtotal,
      ivaAmount, irpfAmount, total,
      clientName: 'Test Client',
    },
  })
  return invoice
}

export async function makeInventoryItem(
  tx: Prisma.TransactionClient,
  companyId: string,
  opts: { qtyInStock: number; costPrice?: number; qtyMinAlert?: number; qtyOrdered?: number },
) {
  return tx.inventoryItem.create({
    data: {
      companyId,
      name: 'Test item',
      unit: 'шт',
      qtyInStock:  new Decimal(opts.qtyInStock),
      qtyOrdered:  new Decimal(opts.qtyOrdered ?? 0),
      costPrice:   new Decimal(opts.costPrice ?? 10),
      sellPrice:   new Decimal(opts.costPrice ?? 10),
      qtyMinAlert: new Decimal(opts.qtyMinAlert ?? 0),
    },
  })
}

export async function makeSupplier(tx: Prisma.TransactionClient, companyId: string, opts?: { name?: string }) {
  return tx.supplier.create({
    data: { companyId, name: opts?.name ?? `Test supplier ${Date.now()}` },
  })
}

interface MakeSupplierBillOpts {
  itemId?:  string
  qty?:     number
  amount:   number
  hasVat?:  boolean
  vatRate?: number
  status?:  'ORDERED' | 'RECEIVED' | 'PAID' | 'CANCELLED'
}

export async function makeSupplierBill(
  tx: Prisma.TransactionClient,
  companyId: string,
  supplierId: string,
  opts: MakeSupplierBillOpts,
) {
  const amount  = new Decimal(opts.amount)
  const vatRate = new Decimal(opts.hasVat ? (opts.vatRate ?? 21) : 0)
  const vatAmount = opts.hasVat ? amount.times(vatRate).div(100).toDecimalPlaces(2) : new Decimal(0)
  const total = amount.plus(vatAmount)

  return tx.supplierBill.create({
    data: {
      companyId, supplierId,
      itemId: opts.itemId,
      description: 'Test supplier bill',
      qty: new Decimal(opts.qty ?? 1),
      amount, hasVat: !!opts.hasVat, vatRate, vatAmount, total,
      status: opts.status ?? 'ORDERED',
    },
  })
}
