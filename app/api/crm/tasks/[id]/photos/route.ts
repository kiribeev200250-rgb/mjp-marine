import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import { uploadTaskPhoto, deleteTaskPhoto, isStorageConfigured } from '@/lib/crm/storage'

export const runtime = 'nodejs'

const MAX_SIZE = 8 * 1024 * 1024 // 8MB
const ALLOWED  = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' } as const

// POST — загрузить фото до/после (multipart: file, kind='before'|'after')
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'EDIT')

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Загрузка фото не настроена — обратитесь к администратору' }, { status: 503 })
  }

  const task = await prisma.task.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!task) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const kind = form.get('kind') as string | null
  if (!file || (kind !== 'before' && kind !== 'after')) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 8МБ)' }, { status: 400 })
  }
  const ext = ALLOWED[file.type as keyof typeof ALLOWED]
  if (!ext) {
    return NextResponse.json({ error: 'Недопустимый формат файла' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadTaskPhoto(id, kind, buffer, file.type, ext)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка загрузки' }, { status: 502 })
  }

  const field = kind === 'before' ? 'photosBefore' : 'photosAfter'
  const updated = await prisma.task.update({
    where: { id },
    data:  { [field]: { push: url } },
  })

  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'Task', entityId: id, meta: { action: 'photo_added', kind },
  })

  return NextResponse.json({ url, photosBefore: updated.photosBefore, photosAfter: updated.photosAfter })
}

// DELETE — убрать фото (body: { kind, url })
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SCHEDULE', 'EDIT')

  const task = await prisma.task.findFirst({ where: { id, companyId: session.user.companyId } })
  if (!task) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const { kind, url } = await req.json()
  if (kind !== 'before' && kind !== 'after') {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  }

  const field = kind === 'before' ? 'photosBefore' : 'photosAfter'
  const current = (kind === 'before' ? task.photosBefore : task.photosAfter) as string[]
  const updated = await prisma.task.update({
    where: { id },
    data:  { [field]: current.filter((u) => u !== url) },
  })

  await deleteTaskPhoto(url)
  await writeAudit({
    companyId: session.user.companyId, userId: session.user.id, action: 'UPDATE',
    entity: 'Task', entityId: id, meta: { action: 'photo_removed', kind },
  })

  return NextResponse.json({ photosBefore: updated.photosBefore, photosAfter: updated.photosAfter })
}
