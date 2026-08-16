import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { taskScopeWhere, clientScopeWhere } from '@/lib/crm/scope'
import { prisma } from '@/lib/prisma'

const LIMIT = 6

interface SearchHit {
  id:       string
  label:    string
  sublabel: string
  href:     string
}

// Полнотекстовый поиск не подключён (нет расширения/индекса под него) —
// contains(insensitive) по паре полей на модель достаточно для объёма данных
// одной мобильной мастерской и не требует миграции. Токенизация имени
// клиента (AND по словам через firstName/lastName/phone/email) — чтобы
// "Иван Иванов" находил клиента, у которого имя и фамилия лежат в разных
// колонках, а не только односложный запрос.
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ clients: [], boats: [], tasks: [], quotes: [], invoices: [] })
  }

  const { role, permissions, companyId } = session.user
  const canClients  = hasPermission(role, permissions, 'CLIENTS', 'VIEW')
  const canSchedule = hasPermission(role, permissions, 'SCHEDULE', 'VIEW')
  const canInvoices = hasPermission(role, permissions, 'INVOICES', 'VIEW')

  const tokens = q.split(/\s+/).filter(Boolean)
  const nameTokenFilters = tokens.map((tok) => ({
    OR: [
      { firstName: { contains: tok, mode: 'insensitive' as const } },
      { lastName:  { contains: tok, mode: 'insensitive' as const } },
      { phone:     { contains: tok } },
      { email:     { contains: tok, mode: 'insensitive' as const } },
    ],
  }))

  const [clients, boats, tasks, quotes, invoices] = await Promise.all([
    canClients
      ? prisma.client.findMany({
          where: { companyId, ...clientScopeWhere(session.user), AND: nameTokenFilters },
          select: { id: true, firstName: true, lastName: true, phone: true },
          take: LIMIT,
        })
      : Promise.resolve([]),

    canClients
      ? prisma.yacht.findMany({
          where: {
            client: { companyId, ...clientScopeWhere(session.user) },
            OR: [
              { name:      { contains: q, mode: 'insensitive' } },
              { model:     { contains: q, mode: 'insensitive' } },
              { regNumber: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, model: true, clientId: true, client: { select: { firstName: true, lastName: true } } },
          take: LIMIT,
        })
      : Promise.resolve([]),

    canSchedule
      ? prisma.task.findMany({
          where: { companyId, ...taskScopeWhere(session.user), title: { contains: q, mode: 'insensitive' } },
          select: { id: true, title: true, status: true, scheduledAt: true },
          take: LIMIT,
          orderBy: { scheduledAt: 'desc' },
        })
      : Promise.resolve([]),

    canInvoices
      ? prisma.quote.findMany({
          where: { companyId, number: { contains: q, mode: 'insensitive' } },
          select: { id: true, number: true, client: { select: { firstName: true, lastName: true } } },
          take: LIMIT,
        })
      : Promise.resolve([]),

    canInvoices
      ? prisma.invoice.findMany({
          where: { companyId, number: { contains: q, mode: 'insensitive' } },
          select: { id: true, number: true, client: { select: { firstName: true, lastName: true } } },
          take: LIMIT,
        })
      : Promise.resolve([]),
  ])

  const result: {
    clients:  SearchHit[]
    boats:    SearchHit[]
    tasks:    SearchHit[]
    quotes:   SearchHit[]
    invoices: SearchHit[]
  } = {
    clients: clients.map((c) => ({
      id: c.id, label: `${c.firstName} ${c.lastName}`.trim(), sublabel: c.phone || '',
      href: `/crm/clients/${c.id}`,
    })),
    boats: boats.map((b) => ({
      id: b.id, label: b.name || b.model || 'Лодка без названия',
      sublabel: `${b.client.firstName} ${b.client.lastName}`.trim(),
      href: `/crm/clients/${b.clientId}/boats/${b.id}`,
    })),
    tasks: tasks.map((t) => ({
      id: t.id, label: t.title,
      sublabel: t.scheduledAt ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(t.scheduledAt) : t.status,
      href: `/crm/schedule/${t.id}`,
    })),
    quotes: quotes.map((q2) => ({
      id: q2.id, label: `Смета ${q2.number}`, sublabel: `${q2.client.firstName} ${q2.client.lastName}`.trim(),
      href: `/crm/invoices/quote/${q2.id}`,
    })),
    invoices: invoices.map((i) => ({
      id: i.id, label: `Счёт ${i.number}`, sublabel: `${i.client.firstName} ${i.client.lastName}`.trim(),
      href: `/crm/invoices/${i.id}`,
    })),
  }

  return NextResponse.json(result)
}
