// Pages Router API route (не app/api) — намеренно.
// @react-pdf/renderer использует собственный react-reconciler и ломается
// с "React error #31" при бандлинге внутри app/**, где Next применяет
// react-server условие резолва для 'react' (react.shared-subset.js).
// Pages Router не участвует в этом графе — 'react' резолвится штатно.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCrmSessionApi } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { renderDocumentPdf } from '@/lib/crm/pdf'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getCrmSessionApi(req, res)
  if (!session) return res.status(401).json({ error: 'Не авторизован' })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')) return res.status(403).json({ error: 'Недостаточно прав' })
  const id = String(req.query.id)
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
    },
  })
  if (!quote) return res.status(404).json({ error: 'Не найдено' })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })

  const stream = await renderDocumentPdf({
    kind:       'quote',
    number:     quote.number,
    date:       quote.createdAt,
    validUntil: quote.validUntil,
    language:   quote.language,
    company:    { ...companyInfo, logoUrl: companyInfo.logoUrl },
    clientName: `${quote.client.firstName} ${quote.client.lastName}`.trim(),
    jobs: quote.jobs.map((j) => ({
      title:      j.title,
      laborHours: j.laborHours?.toString() ?? null,
      laborRate:  j.laborRate?.toString() ?? null,
      quantity:   j.quantity?.toString() ?? null,
      unitPrice:  j.unitPrice?.toString() ?? null,
      laborCost:  j.laborCost.toString(),
      materials: j.materials.map((m) => ({
        name:      m.name,
        quantity:  m.quantity.toString(),
        unitPrice: m.unitPrice.toString(),
        total:     m.total.toString(),
      })),
    })),
    jobsTotal:      quote.jobsTotal.toString(),
    materialsTotal: quote.materialsTotal.toString(),
    discountAmount: quote.discountAmount.toString(),
    subtotal:       quote.subtotal.toString(),
    ivaRate:        quote.ivaRate.toString(),
    ivaAmount:      quote.ivaAmount.toString(),
    total:          quote.total.toString(),
    notes:          quote.notes,
  })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${quote.number}.pdf"`)
  stream.pipe(res)
}
