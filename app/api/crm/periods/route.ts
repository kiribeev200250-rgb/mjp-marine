import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'

type Unit = 'MONTH' | 'QUARTER' | 'YEAR'

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function computeRange(unit: Unit, year: number, month?: number, quarter?: number) {
  if (unit === 'MONTH') {
    if (!month || month < 1 || month > 12) throw new Error('Некорректный месяц')
    return {
      startDate: new Date(year, month - 1, 1),
      endDate:   new Date(year, month, 1),
      label:     `${MONTH_NAMES[month - 1]} ${year}`,
    }
  }
  if (unit === 'QUARTER') {
    if (!quarter || quarter < 1 || quarter > 4) throw new Error('Некорректный квартал')
    const startMonth = (quarter - 1) * 3
    return {
      startDate: new Date(year, startMonth, 1),
      endDate:   new Date(year, startMonth + 3, 1),
      label:     `${quarter} квартал ${year}`,
    }
  }
  return {
    startDate: new Date(year, 0, 1),
    endDate:   new Date(year + 1, 0, 1),
    label:     `${year} год`,
  }
}

// GET /api/crm/periods — список закрытых периодов
export async function GET() {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const locks = await prisma.periodLock.findMany({
    where:   { companyId: session.user.companyId },
    orderBy: { startDate: 'desc' },
    include: { closedBy: { select: { name: true } } },
  })
  return NextResponse.json(locks)
}

// POST /api/crm/periods — закрыть период. Только ADMIN.
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Закрывать период может только администратор' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { unit, year, month, quarter } = body as { unit?: Unit; year?: number; month?: number; quarter?: number }

  if (!unit || !['MONTH', 'QUARTER', 'YEAR'].includes(unit)) {
    return NextResponse.json({ error: 'Некорректный тип периода' }, { status: 400 })
  }
  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Некорректный год' }, { status: 400 })
  }

  let range
  try {
    range = computeRange(unit, year, month, quarter)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректный период' }, { status: 400 })
  }

  const overlap = await prisma.periodLock.findFirst({
    where: {
      companyId: session.user.companyId,
      startDate: { lt: range.endDate },
      endDate:   { gt: range.startDate },
    },
  })
  if (overlap) {
    return NextResponse.json({ error: `Пересекается с уже закрытым периодом «${overlap.label}»` }, { status: 400 })
  }

  const lock = await prisma.$transaction(async (tx) => {
    const l = await tx.periodLock.create({
      data: {
        companyId:  session.user.companyId,
        startDate:  range.startDate,
        endDate:    range.endDate,
        label:      range.label,
        closedById: session.user.id,
      },
    })
    await tx.auditLog.create({
      data: {
        companyId: session.user.companyId,
        userId:    session.user.id,
        action:    'CREATE',
        entity:    'PeriodLock',
        entityId:  l.id,
        newValue:  { label: range.label, startDate: range.startDate, endDate: range.endDate },
      },
    })
    return l
  })

  return NextResponse.json(lock, { status: 201 })
}
