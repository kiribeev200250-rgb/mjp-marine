// Pages Router API route (не app/api) — см. комментарий в quotes/[id]/pdf.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCrmSessionApi } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { renderDocumentPdf } from '@/lib/crm/pdf'
import { sendDocumentEmail } from '@/lib/resend'
import { formatMoney } from '@/lib/crm/utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getCrmSessionApi(req, res)
  if (!session) return res.status(401).json({ error: 'Не авторизован' })
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'EDIT')

  const id = String(req.query.id)
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { items: { orderBy: { sortOrder: 'asc' } }, client: true },
  })
  if (!quote) return res.status(404).json({ error: 'Не найдено' })
  if (!quote.client.email) return res.status(400).json({ error: 'У клиента не указан email' })

  const companyInfo = await prisma.companyInfo.findUniqueOrThrow({ where: { companyId: session.user.companyId } })

  const stream = await renderDocumentPdf({
    kind:       'quote',
    number:     quote.number,
    date:       quote.createdAt,
    validUntil: quote.validUntil,
    language:   quote.language,
    company:    companyInfo,
    clientName: `${quote.client.firstName} ${quote.client.lastName}`.trim(),
    items:      quote.items.map((it) => ({
      description: it.description,
      quantity:    it.quantity.toString(),
      unitPrice:   it.unitPrice.toString(),
      total:       it.total.toString(),
    })),
    subtotal:  quote.subtotal.toString(),
    ivaRate:   quote.ivaRate.toString(),
    ivaAmount: quote.ivaAmount.toString(),
    total:     quote.total.toString(),
    notes:     quote.notes,
  })

  const publicLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/quotes/${quote.publicToken}`

  try {
    await sendDocumentEmail({
      kind:           'quote',
      to:             quote.client.email,
      clientName:     `${quote.client.firstName} ${quote.client.lastName}`.trim(),
      number:         quote.number,
      totalFormatted: formatMoney(quote.total),
      language:       quote.language,
      pdfStream:      stream,
      publicLink,
    })
  } catch {
    return res.status(502).json({ error: 'Не удалось отправить письмо' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.update({
      where: { id },
      data:  quote.status === 'DRAFT' ? { status: 'SENT' } : {},
    })
    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'SEND_EMAIL',
        entity:    'Quote',
        entityId:  id,
        meta:      { to: quote.client.email },
      },
    })
    return q
  })

  return res.status(200).json(updated)
}
