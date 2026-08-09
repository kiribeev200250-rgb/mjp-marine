import type { StorageAdapter } from 'grammy'
import { prisma } from '@/lib/prisma'

// grammY session storage поверх Postgres — сессии (в т.ч. диалоги @grammyjs/conversations)
// должны переживать серверлесс-инвокейшены между сообщениями одного диалога.
export function prismaStorage<T>(): StorageAdapter<T> {
  return {
    async read(key) {
      const row = await prisma.telegramSession.findUnique({ where: { key } })
      return row ? (row.data as T) : undefined
    },
    async write(key, value) {
      await prisma.telegramSession.upsert({
        where:  { key },
        create: { key, data: value as object },
        update: { data: value as object },
      })
    },
    async delete(key) {
      await prisma.telegramSession.delete({ where: { key } }).catch(() => {})
    },
  }
}
