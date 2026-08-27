import type { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
import { nextDocumentNumber } from '@/lib/crm/numbering'
import { companyInfoSnapshot } from '@/lib/crm/documentJobs'
import { writeOffInvoiceMaterials } from '@/lib/crm/services/invoiceCascade'
import { writeOffMaterials, type TaskMaterial, type LowStockAlert } from '@/lib/crm/services/taskMaterials'
import { prisma } from '@/lib/prisma'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Пайплайн работ — сумма ещё НЕ выставленных работ по проектам (PLANNED/DONE,
// т.е. всё, что не MOVED_TO_INVOICE). Отдельный, самый ранний уровень
// воронки денег: пайплайн (запланировано в проектах) → дебиторка
// (outstandingBalances, выставлено, не оплачено) → доход (FinanceEntry,
// реально оплачено). Три источника правды, не путать: эта функция никогда
// не смотрит на Invoice/FinanceEntry, только на ProjectWork.
export interface ProjectPipelineFilter {
  companyId: string
  boatId?:   string
  clientId?: string
}

export async function computeProjectPipeline(filter: ProjectPipelineFilter): Promise<Decimal> {
  const works = await prisma.projectWork.findMany({
    where: {
      status: { in: ['PLANNED', 'DONE'] },
      project: {
        companyId: filter.companyId,
        ...(filter.boatId   && { boatId: filter.boatId }),
        ...(filter.clientId && { boat: { clientId: filter.clientId } }),
      },
    },
    include: { materials: true },
  })
  return works.reduce(
    (s, w) => s.plus(w.laborCost.toString()).plus(w.materials.reduce((ms, m) => ms.plus(m.total.toString()), new Decimal(0))),
    new Decimal(0),
  )
}

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

// Двусторонняя синхронизация «выполнена» между задачей календаря и работой
// проекта (см. Task.projectWork / ProjectWork.taskId). Единственное, что
// синхронизируется, — сам факт готовности: DONE↔DONE, что угодно другое↔
// PLANNED. Работу, уже перенесённую в счёт (MOVED_TO_INVOICE), синк не
// трогает никогда — это терминальный статус, «отменить» выставленный счёт
// через отметку в календаре нельзя.

// Направление 1: задача → работа проекта. Вызывать ПОСЛЕ смены Task.status
// внутри той же транзакции (см. app/api/crm/tasks/[id]/route.ts,
// app/api/crm/tasks/bulk/route.ts). Чисто смена статуса — склад/деньги
// проект никогда не проводит сам, поэтому здесь их и не может быть.
export async function syncProjectWorkFromTaskStatus(tx: Tx, taskId: string, newTaskStatus: string): Promise<void> {
  const work = await tx.projectWork.findUnique({ where: { taskId } })
  if (!work || work.status === 'MOVED_TO_INVOICE') return

  const nextStatus = newTaskStatus === 'DONE' ? 'DONE' : 'PLANNED'
  if (work.status !== nextStatus) {
    await tx.projectWork.update({ where: { id: work.id }, data: { status: nextStatus } })
  }
}

// Направление 2: работа проекта → связанная задача (отметили выполненной
// прямо в проекте, не через календарь). Если у работы есть Task — та же
// логика завершения, что и обычный PATCH задачи: completedAt, и, если у
// задачи (не работы!) заполнен свой plannedMaterials и он ещё не списан —
// то же автосписание склада, что сработало бы при завершении из календаря
// (см. lib/crm/services/taskMaterials.ts) — чтобы поведение не расходилось
// в зависимости от того, откуда отметили готовность.
export async function syncTaskFromProjectWorkStatus(
  tx: Tx,
  companyId: string,
  work: { taskId: string | null },
  newWorkStatus: string,
): Promise<LowStockAlert[]> {
  if (!work.taskId) return []
  const task = await tx.task.findUnique({ where: { id: work.taskId } })
  if (!task) return []

  if (newWorkStatus === 'DONE') {
    if (task.status === 'DONE') return []
    await tx.task.update({ where: { id: task.id }, data: { status: 'DONE', completedAt: new Date() } })
    if (!task.materialsWrittenOff) {
      const materials = Array.isArray(task.plannedMaterials) ? (task.plannedMaterials as unknown as TaskMaterial[]) : []
      if (materials.length > 0) {
        return writeOffMaterials(tx, companyId, task.id, materials)
      }
    }
    return []
  }

  if (task.status === 'DONE') {
    const revertStatus = task.scheduledAt ? 'SCHEDULED' : 'NEW'
    await tx.task.update({ where: { id: task.id }, data: { status: revertStatus, completedAt: null } })
  }
  return []
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

// Переносит выбранные работы проекта (PLANNED или DONE — уже перенесённые в
// счёт не подходят, повторно взять их нельзя) в новый счёт: та же сборка
// jobs/materials, что и обычный POST /api/crm/invoices, плюс — как только
// счёт ISSUED — существующий каскад writeOffInvoiceMaterials (списание
// склада). Проект сам склад/деньги никогда не трогает — только через этот
// путь, ровно как описано в промпте («Проект НЕ проводит склад/деньги сам —
// только через счёт»). Перенесённые работы помечаются MOVED_TO_INVOICE и
// пропадают из активного списка проекта — не задвоятся при повторном переносе,
// потому что выборка ниже исключает уже перенесённые.
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
    where: { id: { in: workIds }, projectId, status: { in: ['PLANNED', 'DONE'] } },
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
        oldValue: { status: w.status },
        newValue: { status: 'MOVED_TO_INVOICE', invoiceId: invoice.id, invoiceNumber: invoice.number },
      },
    })
  }

  return { invoice, cascade }
}

export interface MoveToQuoteOpts {
  ivaRate?:      number | string
  language?:     string
  validUntil?:   string | null
}

// Переносит выбранные работы проекта в новый пресмет (Presupuesto) — в
// отличие от счёта, работы ОСТАЮТСЯ в проекте (пресмет предварительный, не
// обязательство, можно переоценивать и пере-предлагать клиенту несколько
// раз). Единственный эффект на ProjectWork — quoteId обновляется на
// последний пресмет, куда её включили (не история всех пресметов, именно
// "куда её сейчас предлагают"). Пресмет никогда не трогает склад/деньги —
// это ровно так же, как обычный POST /api/crm/quotes, просто позиции берутся
// из проекта, а не вводятся вручную.
export async function moveProjectWorksToQuote(
  tx: Tx,
  companyId: string,
  userId: string,
  projectId: string,
  workIds: string[],
  opts: MoveToQuoteOpts,
) {
  const project = await tx.project.findFirst({
    where: { id: projectId, companyId },
    include: { boat: { include: { client: true } } },
  })
  if (!project) throw new Error('Проект не найден')

  const works = await tx.projectWork.findMany({
    where: { id: { in: workIds }, projectId, status: { in: ['PLANNED', 'DONE'] } },
    include: { materials: true },
    orderBy: { sortOrder: 'asc' },
  })
  if (works.length === 0) throw new Error('Нет работ для переноса — уже перенесены в счёт или не найдены')

  const client = project.boat.client

  const jobsTotal = works.reduce((s, w) => s.plus(w.laborCost.toString()), new Decimal(0))
  const materialsTotal = works.reduce(
    (s, w) => s.plus(w.materials.reduce((ms, m) => ms.plus(m.total.toString()), new Decimal(0))),
    new Decimal(0),
  )
  const subtotal = jobsTotal.plus(materialsTotal)
  const iva = new Decimal(opts.ivaRate ?? 21)
  if (iva.lt(0) || iva.gt(100)) throw new Error('Ставка IVA должна быть от 0 до 100%')
  const ivaAmount = subtotal.times(iva).div(100).toDecimalPlaces(2)
  const total = subtotal.plus(ivaAmount)

  const { number } = await nextDocumentNumber(tx, companyId, 'quote')

  const quote = await tx.quote.create({
    data: {
      companyId,
      clientId: client.id,
      boatId:   project.boatId,
      number,
      language:   opts.language || client.language || 'ru',
      validUntil: opts.validUntil ? new Date(opts.validUntil) : null,
      ivaRate: iva,
      jobsTotal, materialsTotal, subtotal, ivaAmount, total,
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

  await tx.projectWork.updateMany({
    where: { id: { in: works.map((w) => w.id) } },
    data:  { quoteId: quote.id },
  })

  await tx.auditLog.create({
    data: {
      companyId, userId,
      action:   'CREATE',
      entity:   'Quote',
      entityId: quote.id,
      newValue: { number: quote.number, total: quote.total.toString(), fromProject: project.name },
      meta:     { linkedWorkIds: works.map((w) => w.id) },
    },
  })
  for (const w of works) {
    await tx.auditLog.create({
      data: {
        companyId, userId,
        action:   'UPDATE',
        entity:   'ProjectWork',
        entityId: w.id,
        oldValue: { quoteId: w.quoteId },
        newValue: { quoteId: quote.id, quoteNumber: quote.number },
      },
    })
  }

  return { quote }
}
