// Pages Router API route (не app/api) — см. комментарий в quotes/[id]/pdf.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCrmSessionApi } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { renderDocumentPdf, resolveInvoiceCompanyInfo } from '@/lib/crm/pdf'
import { sendDocumentEmail } from '@/lib/resend'
import { formatMoney } from '@/lib/crm/utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getCrmSessionApi(req, res)
  if (!session) return res.status(401).json({ error: 'Не авторизован' })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const id = String(req.query.id)
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      jobs: { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client: true,
    },
  })
  if (!invoice) return res.status(404).json({ error: 'Не найдено' })
  if (!invoice.client.email) return res.status(400).json({ error: 'У клиента не указан email' })

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

  try {
    await sendDocumentEmail({
      kind:           'invoice',
      to:             invoice.client.email,
      clientName:     invoice.clientName,
      number:         invoice.number,
      totalFormatted: formatMoney(invoice.total),
      language:       invoice.language,
      pdfStream:      stream,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Не удалось отправить письмо'
    await prisma.invoice.update({ where: { id }, data: { lastEmailError: message, lastEmailSentAt: null } })
    return res.status(502).json({ error: message })
  }

  await prisma.invoice.update({ where: { id }, data: { lastEmailSentAt: new Date(), lastEmailError: null } })

  await prisma.auditLog.create({
    data: {
      companyId: session.user.companyId,
      userId:    session.user.id,
      action:    'SEND_EMAIL',
      entity:    'Invoice',
      entityId:  id,
      meta:      { to: invoice.client.email },
    },
  })

  return res.status(200).json({ ok: true })
}
