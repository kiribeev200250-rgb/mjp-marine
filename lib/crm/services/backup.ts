import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
// Относительный импорт (не '@/lib/prisma') намеренно — этот модуль запускается
// и из Next.js (алиас работает), и напрямую через ts-node в scripts/backup.ts
// (алиас не настроен, tsconfig-paths не подключен) — см. package.json db:backup.
import { prisma } from '../../prisma'

const BUCKET = 'db-backups'

// Порядок для ЭКСПОРТА не важен — каждая таблица выгружается независимо.
// Порядок для ВОССТАНОВЛЕНИЯ важен: родительские таблицы (без внешних ключей
// на другие таблицы бэкапа) должны идти раньше зависимых, иначе createMany
// упадёт на нарушении FK. Список ниже — валидный топологический порядок по
// схеме на момент написания; при добавлении новых моделей со связями
// проверяй/дополняй порядок.
const MODELS_IN_DEPENDENCY_ORDER = [
  // Публичный сайт — самостоятельные таблицы, без FK друг на друга
  'siteConfig', 'galleryItem', 'service', 'testimonial', 'pageText',
  'contactRequest', 'subscriber', 'adminUser', 'presiteConfig', 'presiteScan',
  'presiteLink',
  'presiteStat', // → PresiteLink

  // CRM — компания и справочники
  'company',
  'crmUser', 'companyInfo', 'category', 'referenceItem', 'kpiGoal', // → Company
  'telegramSession', // самостоятельная (ключ — не FK)
  'periodLock',      // → Company, CrmUser?
  'sequenceCounter', // → Company
  'jobTemplate',     // → Company

  // Клиенты и лодки
  'client',            // → Company
  'yacht',             // → Client
  'funnelHistory',     // → Client
  'note',              // → Company, Client?, Yacht?, CrmUser?
  'project',           // → Company, Yacht

  // Склад
  'supplier',          // → Company
  'inventoryItem',     // → Company, Supplier?

  // Документы
  'quote',             // → Company, Client, Yacht?
  'quoteJob',           // → Quote
  'quoteMaterial',       // → QuoteJob, InventoryItem?
  'invoice',            // → Company, Client, Yacht?, Quote?
  'invoiceJob',          // → Invoice
  'invoiceMaterial',      // → InvoiceJob, InventoryItem?

  // Задачи
  'task',              // → Company, Client?, Yacht?, Quote?, CrmUser (assignee)?

  // Работы проекта — после task/quote/invoice (ссылается на все три опционально)
  'projectWork',         // → Project, Task?, Quote?, Invoice?
  'projectWorkMaterial',  // → ProjectWork, InventoryItem?

  // Финансы (FinanceEntry ссылается сама на себя через reversalOfId —
  // экспортируется в хронологическом порядке, поэтому исходная запись
  // всегда идёт раньше своего сторно в массиве)
  'capitalEntry',        // → Company
  'financeEntry',         // → Company, Category?, Client?, Invoice?, FinanceEntry (self)?
  'recurringExpense',      // → Company, Category?
  'recurringExpenseOccurrence', // → RecurringExpense, FinanceEntry? (после financeEntry — важно для FK)
  'vatEntry',              // → Company, Invoice?, FinanceEntry?
  'stockMovement',          // → Company, InventoryItem, Invoice?, Task?
  'supplierBill',           // → Company, Supplier, Task?, Client?, InventoryItem?, FinanceEntry?

  // Служебное
  'auditLog',   // → Company, CrmUser?
  'reminder',   // → Company, Task?
] as const

type ModelName = (typeof MODELS_IN_DEPENDENCY_ORDER)[number]

export interface BackupPayload {
  exportedAt: string
  order:      ModelName[]
  tables:     Record<string, unknown[]>
}

// Полная выгрузка всех таблиц в один JSON-снапшот. Decimal/Date сериализуются
// стандартным JSON.stringify корректно (Decimal.toJSON → строка, Date.toJSON
// → ISO-строка) — восстановление разбирает их обратно теми же типами, что
// принимает Prisma (строки для Decimal, ISO-строки для DateTime).
export async function exportDatabaseBackup(): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {}

  // Модели с самоссылкой (reversalOfId/reworkOf...Id — запись-«потомок» всегда
  // создана позже той, на которую ссылается) — выгружаем в хронологическом
  // порядке, иначе createMany при восстановлении может упасть на FK: ссылка
  // на ещё не вставленную (в этом же batch'е) строку той же таблицы.
  const SELF_REFERENCING_MODELS = new Set(['financeEntry', 'capitalEntry', 'task', 'invoice'])

  for (const model of MODELS_IN_DEPENDENCY_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (prisma as any)[model]
    if (SELF_REFERENCING_MODELS.has(model)) {
      tables[model] = await client.findMany({ orderBy: { createdAt: 'asc' } })
    } else {
      tables[model] = await client.findMany()
    }
  }

  return { exportedAt: new Date().toISOString(), order: [...MODELS_IN_DEPENDENCY_ORDER], tables }
}

function getStorageClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export function isBackupStorageConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

// Выгружает бэкап и кладёт JSON в приватный бакет db-backups/<companyId?>/<timestamp>.json
export async function runAndUploadBackup(): Promise<{ path: string; sizeBytes: number; tableCount: number; rowCount: number }> {
  const supabase = getStorageClient()
  if (!supabase) throw new Error('Supabase Storage не настроен — добавьте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env')

  const payload = await exportDatabaseBackup()
  const json = JSON.stringify(payload)
  const rowCount = Object.values(payload.tables).reduce((s, rows) => s + rows.length, 0)

  const ts = payload.exportedAt.replace(/[:.]/g, '-')
  const path = `${ts}.json`

  const { error } = await supabase.storage.from(BUCKET).upload(path, json, {
    contentType: 'application/json',
    upsert: false,
  })
  if (error) throw new Error(`Ошибка загрузки бэкапа в Supabase Storage: ${error.message}`)

  return { path, sizeBytes: Buffer.byteLength(json), tableCount: Object.keys(payload.tables).length, rowCount }
}

// Восстанавливает таблицы из JSON-снапшота (см. exportDatabaseBackup) в
// строгом порядке зависимостей. skipDuplicates — безопасно повторно запускать
// на БД, где часть строк уже есть (например, восстанавливаешь только то, что
// пропало). options.onlyModels — восстановить не всё, а конкретные таблицы
// (используется в проверочном частичном восстановлении). options.client —
// восстановить в ДРУГУЮ базу, не в основную (используется ежемесячным
// dry-run'ом восстановления, см. runBackupRestoreDryRun ниже).
export async function restoreDatabaseBackup(
  payload: BackupPayload,
  options?: { onlyModels?: string[]; client?: PrismaClient },
): Promise<Record<string, number>> {
  const restored: Record<string, number> = {}
  const db = options?.client ?? prisma

  await db.$transaction(async (tx) => {
    for (const model of payload.order) {
      if (options?.onlyModels && !options.onlyModels.includes(model)) continue
      const rows = payload.tables[model]
      if (!rows || rows.length === 0) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (tx as any)[model]
      const result = await client.createMany({ data: rows, skipDuplicates: true })
      restored[model] = result.count
    }
  })

  return restored
}

export interface DryRunReport {
  configured:  boolean
  ok?:         boolean
  error?:      string
  tableCount?: number
  rowCount?:   number
  mismatches?: { table: string; expected: number; restored: number }[]
}

// Ежемесячная проверка «бэкап реально восстановим», не только «делается» —
// см. app/api/crm/cron/backup-restore-check/route.ts. Экспортирует текущую
// БД и восстанавливает снапшот в ОТДЕЛЬНУЮ тестовую базу (не в продакшен —
// восстановление использует skipDuplicates, но гонять его по продакшену всё
// равно незачем и рискованно). Тестовая база — пустой Supabase-проект с той
// же схемой (см. docs/backup-recovery.md, "Проверка восстановления"),
// её URL — в BACKUP_RESTORE_TEST_DATABASE_URL. Без этой переменной проверка
// не запускается — вызывающий код обязан явно сообщить об этом (configured:
// false), а не молчать, будто всё проверено.
export async function runBackupRestoreDryRun(): Promise<DryRunReport> {
  const testUrl = process.env.BACKUP_RESTORE_TEST_DATABASE_URL
  if (!testUrl) return { configured: false }

  const payload = await exportDatabaseBackup()
  const testClient = new PrismaClient({ datasources: { db: { url: testUrl } } })

  try {
    await restoreDatabaseBackup(payload, { client: testClient })

    const mismatches: DryRunReport['mismatches'] = []
    for (const model of payload.order) {
      const expected = payload.tables[model]?.length ?? 0
      if (expected === 0) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const restoredCount = await (testClient as any)[model].count()
      if (restoredCount < expected) mismatches.push({ table: model, expected, restored: restoredCount })
    }

    return {
      configured:  true,
      ok:          mismatches.length === 0,
      mismatches,
      tableCount:  Object.keys(payload.tables).length,
      rowCount:    Object.values(payload.tables).reduce((s, rows) => s + rows.length, 0),
    }
  } catch (e: unknown) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    await testClient.$disconnect()
  }
}
