// Pages Router API route (не app/api) — см. комментарий в quotes/[id]/pdf.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCrmSessionApi } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { renderDocumentPdf, resolveInvoiceCompanyInfo } from '@/lib/crm/pdf'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getCrmSessionApi(req, res)
  if (!session) return res.status(401).json({ error: 'Не авторизован' })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')) return res.status(403).json({ error: 'Недостаточно прав' })
  const id = String(req.query.id)
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } } },
  })
  if (!invoice) return res.status(404).json({ error: 'Не найдено' })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })

  const stream = await renderDocumentPdf({
    kind:       'invoice',
    number:     invoice.number,
    date:       invoice.date,
    dueDate:    invoice.dueDate,
    language:   invoice.language,
    company:    resolveInvoiceCompanyInfo(invoice, companyInfo),
    clientName: invoice.clientName,
    clientNif:  invoice.clientNif,
    clientAddress: invoice.clientAddress,
    jobs: invoice.jobs.map((j) => ({
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
    jobsTotal:      invoice.jobsTotal.toString(),
    materialsTotal: invoice.materialsTotal.toString(),
    subtotal:      invoice.subtotal.toString(),
    ivaRate:       invoice.ivaRate.toString(),
    ivaAmount:     invoice.ivaAmount.toString(),
    irpfRate:      invoice.irpfRate.toString(),
    irpfAmount:    invoice.irpfAmount.toString(),
    total:         invoice.total.toString(),
    paymentMethod: invoice.paymentMethod,
    notes:         invoice.notes,
  })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`)
  stream.pipe(res)
}
