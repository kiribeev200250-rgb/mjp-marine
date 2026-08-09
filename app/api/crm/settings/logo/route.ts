import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import { uploadCompanyLogo, deleteCompanyLogo, isStorageConfigured } from '@/lib/crm/storage'

export const runtime = 'nodejs'

const MAX_SIZE = 4 * 1024 * 1024 // 4MB
const ALLOWED = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' } as const

// POST /api/crm/settings/logo — загрузить логотип компании (multipart: file)
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Загрузка файлов не настроена — обратитесь к администратору' }, { status: 503 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Файл слишком большой (макс. 4МБ)' }, { status: 400 })

  const ext = ALLOWED[file.type as keyof typeof ALLOWED]
  if (!ext) return NextResponse.json({ error: 'Допустимые форматы: PNG, WEBP, JPEG, SVG' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadCompanyLogo(session.user.companyId, buffer, file.type, ext)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка загрузки' }, { status: 502 })
  }

  const prev = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })
  const updated = await prisma.companyInfo.upsert({
    where:  { companyId: session.user.companyId },
    create: { companyId: session.user.companyId, logoUrl: url },
    update: { logoUrl: url },
  })

  if (prev?.logoUrl) void deleteCompanyLogo(prev.logoUrl)

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'CompanyInfo', entityId: updated.id, meta: { action: 'logo_uploaded' },
  })

  return NextResponse.json({ logoUrl: updated.logoUrl })
}

// DELETE /api/crm/settings/logo — убрать логотип
export async function DELETE() {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')

  const prev = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })
  if (!prev) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.companyInfo.update({ where: { companyId: session.user.companyId }, data: { logoUrl: null } })
  if (prev.logoUrl) void deleteCompanyLogo(prev.logoUrl)

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'CompanyInfo', entityId: prev.id, meta: { action: 'logo_removed' },
  })

  return NextResponse.json({ ok: true })
}
