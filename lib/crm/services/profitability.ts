import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import type { InvoiceStatus } from '@prisma/client'

// Прибыльность по сделке/лодке/клиенту/виду работ.
//
// Выручка — netto счёта (subtotal, без IVA). Себестоимость материалов — по
// ТЕКУЩЕЙ закупочной цене склада (InventoryItem.costPrice), а не по цене на
// момент фактического списания (StockMovement.unitPrice): это отчёт о
// прибыльности, не бухгалтерская книга, а costPrice меняется редко. Материал,
// вписанный в счёт вручную (без inventoryItemId, не с полки), себестоимости
// не имеет вообще — считается по нулю, то есть маржа по счетам с такими
// материалами немного завышена. Труд НЕ вычитается: InvoiceJob.laborCost —
// это цена работы, которую платит клиент (часть выручки), а не зарплата
// сотрудника — себестоимости часа в системе нет ни у одной роли.
//
// Считаются сделки в статусах ISSUED/PARTIAL/PAID/OVERDUE — работа выполнена
// и материалы списаны независимо от того, оплатил ли уже клиент; DRAFT и
// CANCELLED исключены (ещё не сделка / не состоялась).
const COUNTED_STATUSES: InvoiceStatus[] = ['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE']

export interface MarginRow {
  key:          string
  label:        string
  revenueNet:   Decimal
  materialCost: Decimal
  margin:       Decimal
  marginPct:    Decimal | null
  invoiceCount: number
}

interface InvoiceForMargin {
  id: string
  boatId: string | null
  clientId: string
  subtotal: Decimal
  jobs: {
    title: string
    laborCost: Decimal
    materials: { quantity: Decimal; total: Decimal; inventoryItem: { costPrice: Decimal } | null }[]
  }[]
}

function materialCostOfJobs(jobs: InvoiceForMargin['jobs']): Decimal {
  let cost = new Decimal(0)
  for (const job of jobs) {
    for (const m of job.materials) {
      if (!m.inventoryItem) continue
      cost = cost.plus(new Decimal(m.quantity.toString()).times(m.inventoryItem.costPrice.toString()))
    }
  }
  return cost
}

async function fetchInvoicesForMargin(companyId: string, from?: Date, to?: Date): Promise<InvoiceForMargin[]> {
  return prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: COUNTED_STATUSES },
      ...(from && to && { date: { gte: from, lt: to } }),
    },
    select: {
      id: true, boatId: true, clientId: true, subtotal: true,
      jobs: {
        select: {
          title: true, laborCost: true,
          materials: { select: { quantity: true, total: true, inventoryItem: { select: { costPrice: true } } } },
        },
      },
    },
  })
}

function toRow(key: string, label: string, revenueNet: Decimal, materialCost: Decimal, invoiceCount: number): MarginRow {
  const margin = revenueNet.minus(materialCost)
  return {
    key, label, revenueNet, materialCost, margin,
    marginPct: revenueNet.gt(0) ? margin.div(revenueNet).times(100) : null,
    invoiceCount,
  }
}

// Маржа по одному счёту (детальная страница счёта) + разбивка по его работам.
export async function computeInvoiceMargin(invoiceId: string): Promise<{
  revenueNet: Decimal; materialCost: Decimal; margin: Decimal; marginPct: Decimal | null
  jobs: { title: string; revenueNet: Decimal; materialCost: Decimal; margin: Decimal }[]
} | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      subtotal: true,
      jobs: {
        select: {
          title: true, laborCost: true,
          materials: { select: { quantity: true, total: true, inventoryItem: { select: { costPrice: true } } } },
        },
      },
    },
  })
  if (!invoice) return null

  const revenueNet = new Decimal(invoice.subtotal.toString())
  const jobs = invoice.jobs.map((job) => {
    const materialsRevenue = job.materials.reduce((s, m) => s.plus(m.total.toString()), new Decimal(0))
    const materialCost = job.materials.reduce((s, m) => (
      m.inventoryItem ? s.plus(new Decimal(m.quantity.toString()).times(m.inventoryItem.costPrice.toString())) : s
    ), new Decimal(0))
    const jobRevenue = new Decimal(job.laborCost.toString()).plus(materialsRevenue)
    return { title: job.title, revenueNet: jobRevenue, materialCost, margin: jobRevenue.minus(materialCost) }
  })
  const materialCost = jobs.reduce((s, j) => s.plus(j.materialCost), new Decimal(0))
  const margin = revenueNet.minus(materialCost)

  return {
    revenueNet, materialCost, margin,
    marginPct: revenueNet.gt(0) ? margin.div(revenueNet).times(100) : null,
    jobs,
  }
}

// Маржа по лодке (одной, для страницы лодки) — сумма по всем её счетам.
export async function computeBoatMargin(boatId: string): Promise<{ revenueNet: Decimal; materialCost: Decimal; margin: Decimal; marginPct: Decimal | null; invoiceCount: number }> {
  const invoices = await prisma.invoice.findMany({
    where: { boatId, status: { in: COUNTED_STATUSES } },
    select: {
      subtotal: true,
      jobs: { select: { title: true, laborCost: true, materials: { select: { quantity: true, total: true, inventoryItem: { select: { costPrice: true } } } } } },
    },
  })
  const revenueNet = invoices.reduce((s, i) => s.plus(i.subtotal.toString()), new Decimal(0))
  const materialCost = invoices.reduce((s, i) => s.plus(materialCostOfJobs(i.jobs)), new Decimal(0))
  const margin = revenueNet.minus(materialCost)
  return { revenueNet, materialCost, margin, marginPct: revenueNet.gt(0) ? margin.div(revenueNet).times(100) : null, invoiceCount: invoices.length }
}

// Маржа по клиенту (одному, для карточки клиента) — сумма по всем его счетам.
export async function computeClientMargin(clientId: string): Promise<{ revenueNet: Decimal; materialCost: Decimal; margin: Decimal; marginPct: Decimal | null; invoiceCount: number }> {
  const invoices = await prisma.invoice.findMany({
    where: { clientId, status: { in: COUNTED_STATUSES } },
    select: {
      subtotal: true,
      jobs: { select: { title: true, laborCost: true, materials: { select: { quantity: true, total: true, inventoryItem: { select: { costPrice: true } } } } } },
    },
  })
  const revenueNet = invoices.reduce((s, i) => s.plus(i.subtotal.toString()), new Decimal(0))
  const materialCost = invoices.reduce((s, i) => s.plus(materialCostOfJobs(i.jobs)), new Decimal(0))
  const margin = revenueNet.minus(materialCost)
  return { revenueNet, materialCost, margin, marginPct: revenueNet.gt(0) ? margin.div(revenueNet).times(100) : null, invoiceCount: invoices.length }
}

// ── Аналитика: срезы по всем лодкам / клиентам / видам работ за период ────

export async function marginByBoat(companyId: string, from?: Date, to?: Date): Promise<MarginRow[]> {
  const invoices = await fetchInvoicesForMargin(companyId, from, to)
  const boatIds = [...new Set(invoices.map((i) => i.boatId).filter((id): id is string => !!id))]
  const boats = await prisma.yacht.findMany({ where: { id: { in: boatIds } }, select: { id: true, name: true, model: true, client: { select: { firstName: true, lastName: true } } } })
  const boatMap = new Map(boats.map((b) => [b.id, b]))

  const groups = new Map<string, { revenueNet: Decimal; materialCost: Decimal; count: number }>()
  for (const inv of invoices) {
    const key = inv.boatId ?? '__none__'
    const g = groups.get(key) ?? { revenueNet: new Decimal(0), materialCost: new Decimal(0), count: 0 }
    g.revenueNet = g.revenueNet.plus(inv.subtotal.toString())
    g.materialCost = g.materialCost.plus(materialCostOfJobs(inv.jobs))
    g.count += 1
    groups.set(key, g)
  }

  return [...groups.entries()]
    .map(([key, g]) => {
      const boat = key !== '__none__' ? boatMap.get(key) : null
      const label = boat ? `${boat.name || boat.model || 'Лодка'} (${boat.client.firstName} ${boat.client.lastName})` : 'Без привязки к лодке'
      return toRow(key, label, g.revenueNet, g.materialCost, g.count)
    })
    .sort((a, b) => b.margin.comparedTo(a.margin))
}

export async function marginByClient(companyId: string, from?: Date, to?: Date): Promise<MarginRow[]> {
  const invoices = await fetchInvoicesForMargin(companyId, from, to)
  const clientIds = [...new Set(invoices.map((i) => i.clientId))]
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, firstName: true, lastName: true } })
  const clientMap = new Map(clients.map((c) => [c.id, c]))

  const groups = new Map<string, { revenueNet: Decimal; materialCost: Decimal; count: number }>()
  for (const inv of invoices) {
    const g = groups.get(inv.clientId) ?? { revenueNet: new Decimal(0), materialCost: new Decimal(0), count: 0 }
    g.revenueNet = g.revenueNet.plus(inv.subtotal.toString())
    g.materialCost = g.materialCost.plus(materialCostOfJobs(inv.jobs))
    g.count += 1
    groups.set(inv.clientId, g)
  }

  return [...groups.entries()]
    .map(([key, g]) => {
      const client = clientMap.get(key)
      const label = client ? `${client.firstName} ${client.lastName}` : 'Клиент удалён'
      return toRow(key, label, g.revenueNet, g.materialCost, g.count)
    })
    .sort((a, b) => b.margin.comparedTo(a.margin))
}

// «Вид работ» — по названию работы (InvoiceJob.title), нормализованному
// trim'ом: отдельного справочника видов работ на уровне счёта в схеме нет,
// заголовок работы — единственная реальная гранулярность, которая есть.
export async function marginByWorkType(companyId: string, from?: Date, to?: Date): Promise<MarginRow[]> {
  const invoices = await fetchInvoicesForMargin(companyId, from, to)

  const groups = new Map<string, { revenueNet: Decimal; materialCost: Decimal; count: number }>()
  for (const inv of invoices) {
    for (const job of inv.jobs) {
      const title = job.title.trim() || 'Без названия'
      // Выручка работы = её laborCost + сумма её материалов по цене продажи
      // (material.total) — не по счёту в целом, иначе несколько работ в
      // одном счёте задваивали бы общую сумму материалов счёта.
      const materialsSale = job.materials.reduce((s, m) => s.plus(m.total.toString()), new Decimal(0))
      const jobMaterialCost = job.materials.reduce((s, m) => (
        m.inventoryItem ? s.plus(new Decimal(m.quantity.toString()).times(m.inventoryItem.costPrice.toString())) : s
      ), new Decimal(0))

      const g = groups.get(title) ?? { revenueNet: new Decimal(0), materialCost: new Decimal(0), count: 0 }
      g.revenueNet = g.revenueNet.plus(job.laborCost.toString()).plus(materialsSale)
      g.materialCost = g.materialCost.plus(jobMaterialCost)
      g.count += 1
      groups.set(title, g)
    }
  }

  return [...groups.entries()]
    .map(([key, g]) => toRow(key, key, g.revenueNet, g.materialCost, g.count))
    .sort((a, b) => b.margin.comparedTo(a.margin))
}
