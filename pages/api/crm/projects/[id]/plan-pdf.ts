// Pages Router API route (не app/api) — намеренно, см. pages/api/crm/quotes/[id]/pdf.ts.
import type { NextApiRequest, NextApiResponse } from 'next'
import Decimal from 'decimal.js'
import { getCrmSessionApi } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { renderDocumentPdf } from '@/lib/crm/pdf'

// GET /api/crm/projects/[id]/plan-pdf?workIds=a,b,c&prices=1&lang=ru — «План
// работ» проекта: НЕ фискальный документ (нет сквозного номера, нет
// обязательства) — просто презентация текущего плана. Ничего не проводит:
// не трогает проект/склад/деньги, только читает. Если workIds не передан —
// включает все работы проекта, кроме уже перенесённых в счёт (они больше не
// «план», это уже свершившееся). prices=0 — без цен (только перечень работ/
// материалов, для согласования объёма).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getCrmSessionApi(req, res)
  if (!session) return res.status(401).json({ error: 'Не авторизован' })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'VIEW')) {
    return res.status(403).json({ error: 'Недостаточно прав' })
  }
  const id = String(req.query.id)

  const project = await prisma.project.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { boat: { include: { client: true } } },
  })
  if (!project) return res.status(404).json({ error: 'Не найдено' })

  const workIdsParam = typeof req.query.workIds === 'string' ? req.query.workIds : ''
  const requestedIds = workIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
  const showPrices = req.query.prices !== '0'
  const lang = typeof req.query.lang === 'string' ? req.query.lang : project.boat.client.language

  const works = await prisma.projectWork.findMany({
    where: {
      projectId: project.id,
      status: { not: 'MOVED_TO_INVOICE' },
      ...(requestedIds.length > 0 && { id: { in: requestedIds } }),
    },
    orderBy: { sortOrder: 'asc' },
    include: { materials: { orderBy: { sortOrder: 'asc' } } },
  })
  if (works.length === 0) return res.status(400).json({ error: 'Нет работ для выгрузки' })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })

  const jobsTotal = works.reduce((s, w) => s.plus(w.laborCost.toString()), new Decimal(0))
  const materialsTotal = works.reduce(
    (s, w) => s.plus(w.materials.reduce((ms, m) => ms.plus(m.total.toString()), new Decimal(0))),
    new Decimal(0),
  )
  const subtotal  = jobsTotal.plus(materialsTotal)
  const ivaRate   = new Decimal(companyInfo.ivaRate.toString())
  const ivaAmount = subtotal.times(ivaRate).div(100).toDecimalPlaces(2)
  const total     = subtotal.plus(ivaAmount)

  const stream = await renderDocumentPdf({
    kind:       'plan',
    number:     project.name,
    date:       new Date(),
    language:   lang,
    company:    { ...companyInfo, logoUrl: companyInfo.logoUrl },
    clientName: `${project.boat.client.firstName} ${project.boat.client.lastName}`.trim(),
    jobs: works.map((w) => ({
      title:      w.title,
      laborHours: w.laborHours?.toString() ?? null,
      laborRate:  w.laborRate?.toString() ?? null,
      quantity:   w.quantity?.toString() ?? null,
      unitPrice:  w.unitPrice?.toString() ?? null,
      laborCost:  w.laborCost.toString(),
      materials: w.materials.map((m) => ({
        name:      m.name,
        quantity:  m.quantity.toString(),
        unitPrice: m.unitPrice.toString(),
        total:     m.total.toString(),
      })),
    })),
    jobsTotal:      jobsTotal.toFixed(2),
    materialsTotal: materialsTotal.toFixed(2),
    subtotal:       subtotal.toFixed(2),
    ivaRate:        ivaRate.toString(),
    ivaAmount:      ivaAmount.toFixed(2),
    total:          total.toFixed(2),
    notes:          `${project.boat.name || project.boat.model || ''}`.trim() || undefined,
    showPrices,
  })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${project.name}-plan.pdf"`)
  stream.pipe(res)
}
