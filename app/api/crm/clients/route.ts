import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import { clientScopeWhere } from '@/lib/crm/scope'
import type { ClientSource, FunnelStage } from '@prisma/client'

// GET /api/crm/clients — список клиентов с поиском и фильтрами
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'CLIENTS', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const { searchParams } = req.nextUrl
  const q       = searchParams.get('q')?.trim()
  const stage   = searchParams.get('stage') as FunnelStage | null
  const source  = searchParams.get('source') as ClientSource | null
  const marina  = searchParams.get('marina')
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit   = 50

  const where = {
    companyId: session.user.companyId,
    active:    true,
    ...(stage  && { funnelStage: stage }),
    ...(source && { source }),
    ...(marina && { marina }),
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' as const } },
        { lastName:  { contains: q, mode: 'insensitive' as const } },
        { phone:     { contains: q, mode: 'insensitive' as const } },
        { email:     { contains: q, mode: 'insensitive' as const } },
        { marina:    { contains: q, mode: 'insensitive' as const } },
      ],
    }),
    // Область видимости (своя марина) перекрывает выбор фильтра марины в UI —
    // не даёт запросить чужую марину через query-параметр.
    ...clientScopeWhere(session.user),
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        yachts:   { select: { model: true, marina: true } },
        _count:   { select: { tasks: true, invoices: true, quotes: true } },
      },
    }),
    prisma.client.count({ where }),
  ])

  return NextResponse.json({ clients, total, page, limit })
}

// POST /api/crm/clients — создать клиента
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'CLIENTS', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const body = await req.json()
  const { firstName, lastName, phone, email, source, language,
          marina, notes, funnelStage } = body

  if (!firstName?.trim()) {
    return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 })
  }

  const client = await prisma.client.create({
    data: {
      companyId: session.user.companyId,
      firstName: firstName.trim(),
      lastName:  (lastName ?? '').trim(),
      phone:     (phone    ?? '').trim(),
      email:     (email    ?? '').trim().toLowerCase(),
      source:    source     ?? 'MANUAL',
      language:  language   ?? 'ru',
      marina:    marina     ?? '',
      notes:     notes      ?? '',
      funnelStage: funnelStage ?? 'NEW_LEAD',
    },
  })

  // Запись начальной стадии воронки
  await prisma.funnelHistory.create({
    data: { clientId: client.id, toStage: client.funnelStage },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'CREATE',
    entity:    'Client',
    entityId:  client.id,
    newValue:  { firstName: client.firstName, lastName: client.lastName },
  })

  return NextResponse.json(client, { status: 201 })
}