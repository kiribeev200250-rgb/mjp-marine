'use client'

import Link from 'next/link'
import { Badge, FUNNEL_TONE } from '@/components/crm/ui'
import { FUNNEL_STAGE_LABELS } from '@/lib/crm/utils'

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook', MANUAL: 'Вручную', REFERRAL: 'Рекомендация',
  WEBSITE: 'Сайт', WHATSAPP: 'WhatsApp', OTHER: 'Другое',
}

interface Client {
  id: string; firstName: string; lastName: string
  phone: string; email: string; marina: string
  source: string; funnelStage: string; createdAt: string
  _count: { tasks: number; invoices: number; quotes: number }
}

interface Props { clients: Client[]; total: number }

export function ClientsTable({ clients, total }: Props) {
  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 py-16 text-center">
        <div className="text-4xl mb-3">👥</div>
        <p className="text-body text-gray-500">Клиентов пока нет</p>
        <Link href="/crm/clients/new">
          <span className="inline-block mt-4 bg-gold hover:bg-gold-dark text-navy font-semibold px-5 py-2 rounded-control text-body transition">
            Добавить первого клиента
          </span>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <p className="text-label text-gray-500 mb-3">Найдено: {total}</p>
      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Клиент', 'Телефон', 'Марина', 'Источник', 'Стадия', 'Задачи', 'Счета'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-label text-gray-500 uppercase tracking-wide font-semibold text-left ${i >= 5 ? 'text-center' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b border-gray-200 last:border-0 hover:bg-gray-50/70 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
              >
                <td className="px-4 py-2.5">
                  <Link href={`/crm/clients/${c.id}`} className="text-navy font-medium hover:text-gold transition text-body">
                    {c.firstName} {c.lastName}
                  </Link>
                  {c.email && <div className="text-gray-500 text-label mt-0.5">{c.email}</div>}
                </td>
                <td className="px-4 py-2.5 text-body text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-2.5 text-body text-gray-500">{c.marina || '—'}</td>
                <td className="px-4 py-2.5 text-label text-gray-500">{SOURCE_LABELS[c.source] ?? c.source}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={FUNNEL_TONE[c.funnelStage] ?? 'neutral'}>
                    {FUNNEL_STAGE_LABELS[c.funnelStage] ?? c.funnelStage}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-center text-label text-gray-500 tabular-nums">{c._count.tasks}</td>
                <td className="px-4 py-2.5 text-center text-label text-gray-500 tabular-nums">{c._count.invoices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}