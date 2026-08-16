import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// GET /api/crm/projects?boatId=... — список проектов лодки
export async function GET(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'VIEW')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const boatId = req.nextUrl.searchParams.get('boatId')
  if (!boatId) return NextResponse.json({ error: 'Укажите лодку' }, { status: 400 })

  const projects = await prisma.project.findMany({
    where:   { companyId: session.user.companyId, boatId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { works: true } } },
  })
  return NextResponse.json(projects)
}

// POST /api/crm/projects — создать проект (накопительный контейнер работ по лодке)
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'PROJECTS', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { boatId, name, notes } = body as { boatId?: string; name?: string; notes?: string }

  if (!boatId) return NextResponse.json({ error: 'Укажите лодку' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Укажите название проекта' }, { status: 400 })

  const boat = await prisma.yacht.findFirst({ where: { id: boatId, client: { companyId: session.user.companyId } } })
  if (!boat) return NextResponse.json({ error: 'Лодка не найдена' }, { status: 404 })

  const project = await prisma.project.create({
    data: { companyId: session.user.companyId, boatId, name: name.trim(), notes: notes ?? '' },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id,
    action: 'CREATE', entity: 'Project', entityId: project.id, newValue: { name: project.name, boatId },
  })

  return NextResponse.json(project, { status: 201 })
}
