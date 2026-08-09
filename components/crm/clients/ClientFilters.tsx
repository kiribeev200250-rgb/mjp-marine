'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { FUNNEL_STAGE_LABELS } from '@/lib/crm/utils'

const SOURCES = [
  { value: 'FACEBOOK', label: 'Facebook'    },
  { value: 'MANUAL',   label: 'Вручную'     },
  { value: 'REFERRAL', label: 'Рекомендация'},
  { value: 'WEBSITE',  label: 'Сайт'        },
  { value: 'WHATSAPP', label: 'WhatsApp'    },
  { value: 'OTHER',    label: 'Другое'      },
]

const selectCls =
  'rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 shadow-e1 ' +
  'focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition'

export function ClientFilters() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams() ?? new URLSearchParams()

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else        next.delete(key)
    next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }, [params, pathname, router])

  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="search"
        placeholder="Поиск по имени, телефону..."
        defaultValue={params.get('q') ?? ''}
        onChange={(e) => update('q', e.target.value)}
        className={`${selectCls} w-64`}
      />
      <select value={params.get('stage') ?? ''} onChange={(e) => update('stage', e.target.value)} className={selectCls}>
        <option value="">Все стадии</option>
        {Object.entries(FUNNEL_STAGE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <select value={params.get('source') ?? ''} onChange={(e) => update('source', e.target.value)} className={selectCls}>
        <option value="">Все источники</option>
        {SOURCES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  )
}