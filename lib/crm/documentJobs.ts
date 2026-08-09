import Decimal from 'decimal.js'

// Общая иерархия «работа → материалы» для Quote и Invoice (QuoteJob/InvoiceJob
// используют одинаковые поля, поэтому парсинг и построение Prisma-инпута общие).

export interface JobMaterialInput {
  name: string
  quantity: string | number
  unitPrice: string | number
  inventoryItemId?: string | null
}

export interface JobInput {
  title: string
  laborHours?: string | number | null
  laborRate?: string | number | null
  laborCost: string | number
  materials?: JobMaterialInput[]
}

export interface ParsedMaterial {
  name: string
  quantity: Decimal
  unitPrice: Decimal
  total: Decimal
  inventoryItemId: string | null
}

export interface ParsedJob {
  title: string
  laborHours: Decimal | null
  laborRate: Decimal | null
  laborCost: Decimal
  materials: ParsedMaterial[]
}

export function parseJobsInput(jobs: JobInput[]): { jobs: ParsedJob[]; jobsTotal: Decimal; materialsTotal: Decimal } {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error('Добавьте хотя бы одну работу')
  }

  const parsed: ParsedJob[] = jobs.map((j) => {
    if (!j.title?.trim()) throw new Error('Укажите название работы')
    const laborCost = new Decimal(j.laborCost || 0)
    if (laborCost.lt(0)) throw new Error('Стоимость работы не может быть отрицательной')

    const materials: ParsedMaterial[] = (j.materials ?? []).map((m) => {
      if (!m.name?.trim()) throw new Error('Укажите название материала')
      const quantity = new Decimal(m.quantity || 0)
      const unitPrice = new Decimal(m.unitPrice || 0)
      if (quantity.lte(0)) throw new Error('Количество материала должно быть больше нуля')
      if (unitPrice.lt(0)) throw new Error('Цена материала не может быть отрицательной')
      return {
        name: m.name.trim(),
        quantity,
        unitPrice,
        total: quantity.times(unitPrice),
        inventoryItemId: m.inventoryItemId || null,
      }
    })

    return {
      title: j.title.trim(),
      laborHours: j.laborHours != null && j.laborHours !== '' ? new Decimal(j.laborHours) : null,
      laborRate: j.laborRate != null && j.laborRate !== '' ? new Decimal(j.laborRate) : null,
      laborCost,
      materials,
    }
  })

  const jobsTotal = parsed.reduce((s, j) => s.plus(j.laborCost), new Decimal(0))
  const materialsTotal = parsed.reduce(
    (s, j) => s.plus(j.materials.reduce((ms, m) => ms.plus(m.total), new Decimal(0))),
    new Decimal(0),
  )

  return { jobs: parsed, jobsTotal, materialsTotal }
}

// Вложенный Prisma create-инпут — форма одинакова для QuoteJob и InvoiceJob.
export function jobsToCreateInput(jobs: ParsedJob[]) {
  return jobs.map((j, i) => ({
    sortOrder: i,
    title: j.title,
    laborHours: j.laborHours,
    laborRate: j.laborRate,
    laborCost: j.laborCost,
    materials: {
      create: j.materials.map((m, mi) => ({
        sortOrder: mi,
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
        total: m.total,
        inventoryItemId: m.inventoryItemId,
      })),
    },
  }))
}
