'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ADMIN_PERMISSIONS } from '@/lib/crm/permissions'
import { seedReferences } from '@/lib/crm/seed-references'
import { seedCategories } from '@/lib/crm/seed-categories'

export async function setupCompanyAction(formData: FormData) {
  const companyName = (formData.get('companyName') as string)?.trim()
  const adminName   = (formData.get('adminName')   as string)?.trim()
  const email       = (formData.get('email')        as string)?.trim().toLowerCase()
  const password    = (formData.get('password')     as string)

  if (!companyName || !adminName || !email || !password) {
    throw new Error('Заполните все поля')
  }
  if (password.length < 8) {
    throw new Error('Пароль должен содержать минимум 8 символов')
  }

  // Идемпотентность — быстрая проверка до транзакции
  const existing = await prisma.company.findFirst({ select: { id: true } })
  if (existing) redirect('/crm/login')

  // bcrypt вынесен ДО транзакции — чтобы не держать соединение во время хеширования
  const hashed      = await bcrypt.hash(password, 12)
  const currentYear = new Date().getFullYear()

  await prisma.$transaction(async (tx) => {
    // Повторная проверка внутри транзакции — защита от гонки
    const race = await tx.company.findFirst({ select: { id: true } })
    if (race) return // другой запрос уже завершил setup — тихо выходим

    // 1. Компания
    const company = await tx.company.create({
      data: { name: companyName },
    })

    // 2. Реквизиты (с заглушками — заполняются в настройках CRM)
    await tx.companyInfo.create({
      data: {
        companyId:     company.id,
        currentYear,
        invoicePrefix: 'F',
        quotePrefix:   'P',
      },
    })

    // 3. Администратор
    await tx.crmUser.create({
      data: {
        companyId:   company.id,
        email,
        password:    hashed,
        name:        adminName,
        role:        'ADMIN',
        permissions: ADMIN_PERMISSIONS,
      },
    })

    // 4. Справочники — передаём tx, чтобы всё откатилось вместе при ошибке
    //    companyId — id только что созданной компании, не устаревшая строка
    await seedReferences(tx, company.id)
    await seedCategories(tx, company.id)
  }, { timeout: 20000 }) // upsert ~50 справочников по сети до хостед Postgres не укладывается в дефолтные 5с

  redirect('/crm/login?setup=done')
}