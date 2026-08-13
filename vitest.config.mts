import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setupEnv.ts'],
    // Денежные каскады бьют в реальную БД (транзакции с откатом или отдельная
    // тестовая компания, см. tests/helpers) — таймауты по умолчанию малы для
    // сетевых Postgres-запросов к Supabase.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Каскады используют транзакции — при параллельном запуске файлов друг
    // друга не задевают (у каждого своя throwaway company/tx), но по
    // умолчанию оставляем последовательно, чтобы не плодить лишние
    // одновременные соединения к пуллеру Supabase.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './'),
    },
  },
})
