import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission, ADMIN_PERMISSIONS } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/crm/audit'

export async function POST(req: NextRequest) {
  try {
    const session = await getCrmSession()
    if (!session) return NextResponse.json({ error: 'Не авт��ризован' }, { status: 401 })

    requirePermission(session.user.role, session.user.permissions, 'SETTINGS', 'CREATE')

    const { companyId, name, email, password, role } = await req.json()

    if (companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Запрещено' }, { status: 403 })
    }
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'За��олните все поля' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Пароль минимум 8 символов' }, { status: 400 })
    }

    const exists = await prisma.crmUser.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'Email уже используется' }, { status: 400 })

    const hashed  = await bcrypt.hash(password, 12)
    // Новые сотрудники начинают без прав — администратор настраивает через матрицу прав
    const permissions = role === 'ADMIN' ? ADMIN_PERMISSIONS : {}

    const user = await prisma.crmUser.create({
      data: { companyId, name, email, password: hashed, role, permissions },
    })

    await writeAudit({
      companyId,
      userId:   session.user.id,
      action:   'CREATE',
      entity:   'CrmUser',
      entityId: user.id,
      newValue: { name: user.name, email: user.email, role: user.role },
    })

    return NextResponse.json({ ok: true, id: user.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка сервера'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}