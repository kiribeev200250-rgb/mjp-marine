import { NextRequest, NextResponse } from 'next/server'
import { runBackupRestoreDryRun } from '@/lib/crm/services/backup'
import { notifyAdmins } from '@/lib/crm/telegram/notify'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 90

// GET /api/crm/cron/backup-restore-check — ежемесячная проверка «бэкап
// реально восстановим» (Vercel Cron, см. vercel.json), не только «делается»
// (см. docs/backup-recovery.md, "Проверка восстановления"). Без настроенной
// BACKUP_RESTORE_TEST_DATABASE_URL шлёт явный алерт о том, что проверка не
// настроена, а не молчит — тихий пропуск неотличим от «всё ок».
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
  }

  const report = await runBackupRestoreDryRun()
  const companies = await prisma.company.findMany({ select: { id: true }, take: 1 })
  const companyId = companies[0]?.id

  if (!report.configured) {
    if (companyId) {
      void notifyAdmins(
        companyId,
        '⚠ Ежемесячная проверка восстановления бэкапа не настроена — добавьте BACKUP_RESTORE_TEST_DATABASE_URL ' +
        '(пустой тестовый Supabase-проект с той же схемой, см. docs/backup-recovery.md).',
      )
    }
    return NextResponse.json({ ok: true, ...report })
  }

  if (companyId) {
    if (report.ok) {
      void notifyAdmins(
        companyId,
        `✅ Проверка восстановления бэкапа: восстановилось — ${report.tableCount} таблиц, ${report.rowCount} строк.`,
      )
    } else if (report.error) {
      void notifyAdmins(companyId, `🔴 Проверка восстановления бэкапа провалилась: ${report.error}`)
    } else {
      const list = (report.mismatches ?? []).map((m) => `${m.table}: ожидалось ${m.expected}, восстановлено ${m.restored}`).join('\n')
      void notifyAdmins(companyId, `🔴 Проверка восстановления бэкапа: расхождение по таблицам —\n${list}`)
    }
  }

  return NextResponse.json({ ok: true, ...report })
}
