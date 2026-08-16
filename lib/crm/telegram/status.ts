import type { TaskStatus } from '@prisma/client'

// Разговорные синонимы для /status <id> <статус> — вводить полный enum с телефона неудобно
const SYNONYMS: Record<string, TaskStatus> = {
  new:         'NEW',
  новая:       'NEW',
  новый:       'NEW',
  scheduled:   'SCHEDULED',
  запланирована: 'SCHEDULED',
  план:        'SCHEDULED',
  progress:    'IN_PROGRESS',
  работа:      'IN_PROGRESS',
  выполняется: 'IN_PROGRESS',
  done:        'DONE',
  готово:      'DONE',
  выполнено:   'DONE',
  выполнена:   'DONE',
  problem:     'PROBLEM',
  проблема:    'PROBLEM',
  cancelled:   'CANCELLED_BY_CLIENT',
  cancel:      'CANCELLED_BY_CLIENT',
  отменено:    'CANCELLED_BY_CLIENT',
  отмена:      'CANCELLED_BY_CLIENT',
}

export function parseTaskStatus(input: string): TaskStatus | null {
  return SYNONYMS[input.trim().toLowerCase()] ?? null
}
