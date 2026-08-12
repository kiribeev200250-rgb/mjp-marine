import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/crm/audit'
import Decimal from 'decimal.js'

export async function POST(req: NextRequest) {
  try {
    const session = await getCrmSession()
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    requirePermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')

    const body = await req.json()
    const { companyId, legalName, nif, address, city, postalCode, country,
            email, phone, bankAccount, ivaRate, irpfRate,
            invoicePrefix, quotePrefix,
            anomalyExpenseMultiplier, anomalyLargeAmountEur } = body

    if (companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Запрещено' }, { status: 403 })
    }

    const prev = await prisma.companyInfo.findUnique({ where: { companyId } })

    const updated = await prisma.companyInfo.upsert({
      where:  { companyId },
      create: {
        companyId,
        legalName, nif, address, city, postalCode, country,
        email, phone, bankAccount,
        ivaRate:  new Decimal(ivaRate  || 21),
        irpfRate: new Decimal(irpfRate || 0),
        invoicePrefix: invoicePrefix || 'F',
        quotePrefix:   quotePrefix   || 'P',
        anomalyExpenseMultiplier: new Decimal(anomalyExpenseMultiplier || 3),
        anomalyLargeAmountEur:    new Decimal(anomalyLargeAmountEur    || 1000),
      },
      update: {
        legalName, nif, address, city, postalCode, country,
        email, phone, bankAccount,
        ivaRate:  new Decimal(ivaRate  || 21),
        irpfRate: new Decimal(irpfRate || 0),
        invoicePrefix: invoicePrefix || 'F',
        quotePrefix:   quotePrefix   || 'P',
        anomalyExpenseMultiplier: new Decimal(anomalyExpenseMultiplier || 3),
        anomalyLargeAmountEur:    new Decimal(anomalyLargeAmountEur    || 1000),
      },
    })

    await writeAudit({
      companyId,
      userId:   session.user.id,
      action:   'UPDATE',
      entity:   'CompanyInfo',
      entityId: updated.id,
      oldValue: prev,
      newValue: updated,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка сервера'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}