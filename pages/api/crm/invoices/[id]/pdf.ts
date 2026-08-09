// Pages Router API route (не app/api) — см. комментарий в quotes/[id]/pdf.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCrmSessionApi } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { renderDocumentPdf } from '@/lib/crm/pdf'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getCrmSessionApi(req, res)
  if (!session) return res.status(401).json({ error: 'Не авторизован' })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const id = String(req.query.id)
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!invoice) return res.status(404).json({ error: 'Не найдено' })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })

  const stream = await renderDocumentPdf({
    kind:       'invoice',
    number:     invoice.number,
    date:       invoice.date,
    dueDate:    invoice.dueDate,
    language:   invoice.language,
    company:    companyInfo,
    clientName: invoice.clientName,
    clientNif:  invoice.clientNif,
    clientAddress: invoice.clientAddress,
    items:      invoice.items.map((it) => ({
      description: it.description,
      quantity:    it.quantity.toString(),
      unitPrice:   it.unitPrice.toString(),
      total:       it.total.toString(),
    })),
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
