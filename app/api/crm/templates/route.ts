import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { parseJobsInput, type JobInput } from '@/lib/crm/documentJobs'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// GET /api/crm/templates — список шаблонов работ (для «применить в один клик»)
export async function GET() {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const templates = await prisma.jobTemplate.findMany({
    where:   { companyId: session.user.companyId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(templates)
}

// POST /api/crm/templates — сохранить текущий набор работ как шаблон
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'INVOICES', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, description, jobs } = body as { name?: string; description?: string; jobs?: JobInput[] }

  if (!name?.trim()) return NextResponse.json({ error: 'Укажите название шаблона' }, { status: 400 })

  // Валидируем структуру той же функцией, что и создание документа — плохой
  // JSON в шаблоне сломал бы применение в новой смете куда менее понятно.
  try {
    parseJobsInput(jobs ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Некорректные позиции' }, { status: 400 })
  }

  const template = await prisma.jobTemplate.create({
    data: {
      companyId:   session.user.companyId,
      name:        name.trim(),
      description: description?.trim() ?? '',
      jobs:        jobs as object,
    },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'CREATE',
    entity:    'JobTemplate',
    entityId:  template.id,
    newValue:  { name: template.name },
  })

  return NextResponse.json(template, { status: 201 })
}
