import Decimal from 'decimal.js'
import type { CompanyInfo, AmountKind } from '@prisma/client'

// Общая иерархия «работа → материалы» для Quote и Invoice (QuoteJob/InvoiceJob
// используют одинаковые поля, поэтому парсинг и построение Prisma-инпута общие).

// Снапшот реквизитов компании в момент выпуска счёта — тот же принцип, что и
// снапшот клиента (clientName/clientNif/clientAddress): выпущенный фискальный
// документ не должен задним числом менять банковский счёт/название компании,
// если владелец поменяет их в настройках позже. Вызывать ТОЛЬКО при переходе
// в ISSUED — черновик снапшота не имеет (companyXxx остаются null), рендерится
// из текущих настроек, пока не зафиксирован.
export function companyInfoSnapshot(companyInfo: CompanyInfo) {
  return {
    companyLegalName:   companyInfo.legalName,
    companyNif:         companyInfo.nif,
    companyAddress:     companyInfo.address,
    companyCity:        companyInfo.city,
    companyPostalCode:  companyInfo.postalCode,
    companyCountry:     companyInfo.country,
    companyBankAccount: companyInfo.bankAccount,
    companyLogoUrl:     companyInfo.logoUrl,
  }
}

// Скидка — отдельная сущность (AmountKind), не заниженная unitPrice/laborCost:
// jobsTotal/materialsTotal остаются каталожными, discountAmount — снапшот в
// валюте, subtotal = catalogSubtotal − discountAmount. Так маржа/аналитика
// видят и каталожную выручку, и сколько именно отдано скидкой, а не тихо
// заниженную «менее маржинальную» работу.
export function computeDiscountAmount(catalogSubtotal: Decimal, discountType: AmountKind | undefined, discountValue: unknown): Decimal {
  if (!discountType || discountType === 'NONE') return new Decimal(0)
  const value = new Decimal(String(discountValue ?? 0))
  if (value.lt(0)) throw new Error('Скидка не может быть отрицательной')
  if (discountType === 'PERCENT') {
    if (value.gt(100)) throw new Error('Скидка в процентах не может быть больше 100%')
    return catalogSubtotal.times(value).div(100).toDecimalPlaces(2)
  }
  // FIXED
  if (value.gt(catalogSubtotal)) throw new Error('Скидка не может быть больше суммы по каталогу')
  return value.toDecimalPlaces(2)
}

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
  quantity?: string | number | null
  unitPrice?: string | number | null
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
  quantity: Decimal | null
  unitPrice: Decimal | null
  laborCost: Decimal
  materials: ParsedMaterial[]
}

export function parseJobsInput(jobs: JobInput[]): { jobs: ParsedJob[]; jobsTotal: Decimal; materialsTotal: Decimal } {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error('Добавьте хотя бы одну работу')
  }

  const parsed: ParsedJob[] = jobs.map((j) => {
    if (!j.title?.trim()) throw new Error('Укажите название работы')

    const laborHours = j.laborHours != null && j.laborHours !== '' ? new Decimal(j.laborHours) : null
    const laborRate  = j.laborRate  != null && j.laborRate  !== '' ? new Decimal(j.laborRate)  : null
    if (laborHours && laborHours.lt(0)) throw new Error('Часы не могут быть отрицательными')
    if (laborRate && laborRate.lt(0)) throw new Error('Норма часа не может быть отрицательной')

    const quantity  = j.quantity  != null && j.quantity  !== '' ? new Decimal(j.quantity)  : null
    const unitPrice = j.unitPrice != null && j.unitPrice !== '' ? new Decimal(j.unitPrice) : null
    if (quantity && quantity.lte(0)) throw new Error('Количество должно быть больше нуля')
    if (unitPrice && unitPrice.lt(0)) throw new Error('Цена за ед. не может быть отрицательной')

    // Три режима стоимости работы, в порядке приоритета (сервер считает сам,
    // не доверяя клиентскому расчёту): часы × норма; количество × цена за ед.
    // (напр. «свечи зажигания» 8 шт, «обслуживание сейлдрайвов» 2 шт);
    // иначе — фиксированная сумма, введённая вручную. Округляем до центов
    // СРАЗУ здесь (не позже) — иначе колонка `laborCost` в БД (Decimal(12,2))
    // округлит независимо от суммы строк на документе, и «сумма строк» на
    // экране/PDF может разойтись с «итого» на цент при дробных часах.
    const laborCost = (laborHours != null && laborRate != null
      ? laborHours.times(laborRate)
      : quantity != null && unitPrice != null
      ? quantity.times(unitPrice)
      : new Decimal(j.laborCost || 0)
    ).toDecimalPlaces(2)
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
        total: quantity.times(unitPrice).toDecimalPlaces(2),
        inventoryItemId: m.inventoryItemId || null,
      }
    })

    return {
      title: j.title.trim(),
      laborHours,
      laborRate,
      quantity,
      unitPrice,
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
    quantity: j.quantity,
    unitPrice: j.unitPrice,
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
