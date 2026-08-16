import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { companyInfoSnapshot } from '@/lib/crm/documentJobs'
import { writeOffInvoiceMaterials } from '@/lib/crm/services/invoiceCascade'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Создаёт задачу в календаре для работы проекта, у которой задана дата —
// двусторонняя связь: taskId на ProjectWork, а сама Task наследует клиента/
// лодку/марину лодки, к которой относится проект. Вызывать ТОЛЬКО внутри
// prisma.$transaction вместе с созданием/апдейтом самой ProjectWork.
export async function createLinkedTask(
  tx: Tx,
  companyId: string,
  work: { title: string; scheduledAt: Date; startTime?: Date | null; endTime?: Date | null },
  boat: { id: string; clientId: string; marina: string },
): Promise<string> {
  const task = await tx.task.create({
    data: {
      companyId,
      title:       work.title,
      clientId:    boat.clientId,
      boatId:      boat.id,
      marina:      boat.marina,
      scheduledAt: work.scheduledAt,
      startTime:   work.startTime ?? null,
      endTime:     work.endTime ?? null,
      status:      'SCHEDULED',
    },
  })
  return task.id
}

export interface MoveToInvoiceOpts {
  ivaRate?:       number | string
  irpfRate?:      number | string
  paymentMethod?: string
  language?:      string
  dueDate?:       string | null
  clientNif?:     string
  clientAddress?: string
  asDraft?:       boolean
}

// Переносит выбранные работы проекта (обязательно PLANNED — уже перенесённые
// или ни разу не тронутые статусом не подходят) в новый счёт: та же сборка
// jobs/materials, что и обычный POST /api/crm/invoices, плюс — как только
// счёт ISSUED — существующий каскад writeOffInvoiceMaterials (списание
// склада). Проект сам склад/деньги никогда не трогает — только через этот
// путь, ровно как описано в промпте («Проект НЕ проводит склад/деньги сам —
// только через счёт»). Перенесённые работы помечаются MOVED_TO_INVOICE и
// пропадают из активного списка проекта — не задвоятся при повторном переносе,
// потому что выборка ниже фильтрует status: 'PLANNED'.
export async function moveProjectWorksToInvoice(
  tx: Tx,
  companyId: string,
  userId: string,
  projectId: string,
  workIds: string[],
  opts: MoveToInvoiceOpts,
) {
  const project = await tx.project.findFirst({
    where: { id: projectId, companyId },
    include: { boat: { include: { client: true } } },
  })
  if (!project) throw new Error('Проект не найден')

  const works = await tx.projectWork.findMany({
    where: { id: { in: workIds }, projectId, status: 'PLANNED' },
    include: { materials: true },
    orderBy: { sortOrder: 'asc' },
  })
  if (works.length === 0) throw new Error('Нет работ для переноса — уже перенесены или не найдены')

  const companyInfo = await tx.companyInfo.findUnique({ where: { companyId } })
  if (!companyInfo || companyInfo.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ') {
    throw new Error('Заполните реквизиты компании в настройках перед выставлением счёта')
  }

  const client = project.boat.client

  const jobsTotal = works.reduce((s, w) => s.plus(w.laborCost.toString()), new Decimal(0))
  const materialsTotal = works.reduce(
    (s, w) => s.plus(w.materials.reduce((ms, m) => ms.plus(m.total.toString()), new Decimal(0))),
    new Decimal(0),
  )
  const subtotal = jobsTotal.plus(materialsTotal)
  const iva  = new Decimal(opts.ivaRate  ?? 21)
  const irpf = new Decimal(opts.irpfRate ?? 0)
  if (iva.lt(0) || iva.gt(100))   throw new Error('Ставка IVA должна быть от 0 до 100%')
  if (irpf.lt(0) || irpf.gt(100)) throw new Error('Ставка IRPF должна быть от 0 до 100%')
  const ivaAmount  = subtotal.times(iva).div(100).toDecimalPlaces(2)
  const irpfAmount = subtotal.times(irpf).div(100).toDecimalPlaces(2)
  const total = subtotal.plus(ivaAmount).minus(irpfAmount)

  const asDraft   = !!opts.asDraft
  const numbering = asDraft ? null : await nextDocumentNumber(tx, companyId, 'invoice')
  const number    = numbering ? numbering.number : `ЧЕРНОВИК-${Date.now().toString(36)}`

  const invoice = await tx.invoice.create({
    data: {
      companyId,
      clientId:      client.id,
      boatId:        project.boatId,
      number,
      year:          numbering?.year ?? null,
      sequenceNum:   numbering?.sequenceNum ?? null,
      status:        asDraft ? 'DRAFT' : 'ISSUED',
      language:      opts.language || client.language || 'ru',
      dueDate:       opts.dueDate ? new Date(opts.dueDate) : null,
      paymentMethod: opts.paymentMethod ?? '',
      ivaRate: iva, irpfRate: irpf,
      jobsTotal, materialsTotal, subtotal, ivaAmount, irpfAmount, total,
      clientName:    `${client.firstName} ${client.lastName}`.trim(),
      clientNif:     opts.clientNif ?? '',
      clientAddress: opts.clientAddress ?? '',
      ...(!asDraft && companyInfoSnapshot(companyInfo)),
      notes: `Перенесено из проекта «${project.name}»`,
      jobs: {
        create: works.map((w, i) => ({
          sortOrder:  i,
          title:      w.title,
          laborHours: w.laborHours,
          laborRate:  w.laborRate,
          quantity:   w.quantity,
          unitPrice:  w.unitPrice,
          laborCost:  w.laborCost,
          materials: {
            create: w.materials.map((m, mi) => ({
              sortOrder: mi,
              name: m.name,
              quantity: m.quantity,
              unitPrice: m.unitPrice,
              total: m.total,
              inventoryItemId: m.inventoryItemId,
            })),
          },
        })),
      },
    },
    include: { jobs: { include: { materials: true } } },
  })

  let cascade: string[] = []
  if (!asDraft) {
    await tx.client.update({ where: { id: client.id }, data: { funnelStage: 'INVOICE_SENT' } })
    await tx.funnelHistory.create({
      data: { clientId: client.id, toStage: 'INVOICE_SENT', note: `Счёт ${invoice.number} выставлен (из проекта «${project.name}»)` },
    })
    cascade = await writeOffInvoiceMaterials(tx, companyId, invoice, invoice.jobs)
  }

  await tx.projectWork.updateMany({
    where: { id: { in: works.map((w) => w.id) } },
    data:  { status: 'MOVED_TO_INVOICE', invoiceId: invoice.id },
  })

  await tx.auditLog.create({
    data: {
      companyId, userId,
      action:   'CREATE',
      entity:   'Invoice',
      entityId: invoice.id,
      newValue: { number: invoice.number, total: invoice.total.toString(), fromProject: project.name },
      meta:     { cascade, movedWorkIds: works.map((w) => w.id) },
    },
  })
  for (const w of works) {
    await tx.auditLog.create({
      data: {
        companyId, userId,
        action:   'STATUS_CHANGE',
        entity:   'ProjectWork',
        entityId: w.id,
        oldValue: { status: 'PLANNED' },
        newValue: { status: 'MOVED_TO_INVOICE', invoiceId: invoice.id, invoiceNumber: invoice.number },
      },
    })
  }

  return { invoice, cascade }
}
