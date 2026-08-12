import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { nextCapitalAutoId } from '@/lib/crm/numbering'
import { findActivePeriodLock } from '@/lib/crm/periodLock'
import type { CapitalEntryType } from '@prisma/client'

const VALID_TYPES: CapitalEntryType[] = ['REINVESTMENT', 'STARTUP_ASSET', 'STARTUP_SUNK']

// GET /api/crm/capital — список вложений (для истории на странице финансов)
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  const entries = await prisma.capitalEntry.findMany({
    where:   { companyId: session.user.companyId },
    orderBy: { date: 'desc' },
    take:    50,
  })
  return NextResponse.json(entries)
}

// POST /api/crm/capital — вложение капитала. НИКОГДА не создаёт FinanceEntry —
// доинвестиции/стартовые не доход и в P&L не попадают.
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')

  const body = await req.json()
  const { type, amount: amountRaw, source, date, note } = body as {
    type?: CapitalEntryType
    amount?: string | number
    source?: string
    date?: string
    note?: string
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Некорректный тип вложения' }, { status: 400 })
  }

  let amount: Decimal
  try {
    amount = new Decimal(String(amountRaw ?? '0'))
    if (amount.lte(0)) throw new Error('Сумма должна быть > 0')
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректная сумма' }, { status: 400 })
  }

  const entryDate = date ? new Date(date) : new Date()
  if (isNaN(entryDate.getTime())) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
  const year      = entryDate.getFullYear()

  const lock = await findActivePeriodLock(session.user.companyId, entryDate)
  if (lock) {
    return NextResponse.json({ error: `Период «${lock.label}» закрыт — новую операцию задним числом создать нельзя` }, { status: 403 })
  }

  const entry = await prisma.$transaction(async (tx) => {
    const autoId = await nextCapitalAutoId(tx, session.user.companyId, year)
    return tx.capitalEntry.create({
      data: {
        companyId: session.user.companyId,
        autoId,
        type,
        date:   entryDate,
        source: (source ?? '').trim(),
        amount,
        note:   (note ?? '').trim(),
      },
    })
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'CREATE',
    entity:    'CapitalEntry',
    entityId:  entry.id,
    newValue:  { type, amount: amount.toString(), source },
  })

  return NextResponse.json(entry, { status: 201 })
}
