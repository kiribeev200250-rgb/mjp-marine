import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const BUCKET = 'task-photos'

// Ленивая инициализация — чтобы отсутствие ключей не ломало сборку/остальной API
// (тот же паттерн, что для Telegram-бота: см. lib/crm/telegram/bot.ts).
function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export function isStorageConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

// Загружает фото в бакет task-photos/{taskId}/{before|after}/{uuid}.{ext} и возвращает публичный URL.
export async function uploadTaskPhoto(
  taskId: string,
  kind: 'before' | 'after',
  file: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const supabase = getClient()
  if (!supabase) throw new Error('Supabase Storage не настроен — добавьте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env')

  const path = `${taskId}/${kind}/${randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType, upsert: false })
  if (error) throw new Error(`Ошибка загрузки в Supabase Storage: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Удаляет фото по его публичному URL (best-effort — не бросает, если не найдено)
export async function deleteTaskPhoto(url: string): Promise<void> {
  const supabase = getClient()
  if (!supabase) return
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = url.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}
