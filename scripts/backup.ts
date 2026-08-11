// Ручной запуск бэкапа БД: npm run db:backup
// Делает то же самое, что ежедневный cron (/api/crm/cron/backup) — выгружает
// все таблицы в JSON и кладёт в приватный бакет Supabase Storage db-backups/.
// Полезно перед рискованной операцией (миграция схемы, массовая правка данных)
// сделать бэкап вручную, не дожидаясь ночного запуска.
import { runAndUploadBackup } from '../lib/crm/services/backup'

async function main() {
  console.log('Выгружаю бэкап...')
  const result = await runAndUploadBackup()
  console.log(`Готово: ${result.path}`)
  console.log(`Таблиц: ${result.tableCount}, строк: ${result.rowCount}, размер: ${(result.sizeBytes / 1024).toFixed(0)} КБ`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('Ошибка бэкапа:', e); process.exit(1) })
