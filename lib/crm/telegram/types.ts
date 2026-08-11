import type { Context, SessionFlavor } from 'grammy'
import type { ConversationFlavor } from '@grammyjs/conversations'

// Короткие номера вместо cuid — чтобы /status 2 done можно было набрать с телефона
export interface TaskListEntry { index: number; id: string; title: string }
export interface InvoiceListEntry { index: number; id: string; number: string }

export interface SessionData {
  lastTaskList?: TaskListEntry[]
  lastInvoiceList?: InvoiceListEntry[]
}

export type MyContext = ConversationFlavor<Context & SessionFlavor<SessionData>>
