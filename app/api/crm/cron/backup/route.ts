import { NextRequest, NextResponse } from 'next/server'
import { runAndUploadBackup } from '@/lib/crm/services/backup'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/crm/cron/backup — ежедневный бэкап БД (Vercel Cron, см. vercel.json).
// Выгружает все таблицы в JSON и кладёт в приватный бакет Supabase Storage
// db-backups/. Это дополнение к встроенным бэкапам/PITR Supabase (основная
// защита — см. docs/backup-recovery.md), а не замена.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
  }

  try {
    const result = await runAndUploadBackup()

    const companies = await prisma.company.findMany({ select: { id: true }, take: 1 })
    if (companies[0]) {
      void notifyAdmins(
        companies[0].id,
        `💾 Бэкап БД: ${result.path} — ${result.tableCount} таблиц, ${result.rowCount} строк, ${(result.sizeBytes / 1024).toFixed(0)} КБ`,
      )
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    console.error('[cron/backup] Ошибка бэкапа', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка бэкапа' }, { status: 500 })
  }
}
