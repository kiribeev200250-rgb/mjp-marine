'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCrmI18n } from '@/components/crm/i18n/CrmI18nProvider'

interface Hit {
  id:       string
  label:    string
  sublabel: string
  href:     string
}

interface SearchResults {
  clients:  Hit[]
  boats:    Hit[]
  tasks:    Hit[]
  quotes:   Hit[]
  invoices: Hit[]
}

const EMPTY: SearchResults = { clients: [], boats: [], tasks: [], quotes: [], invoices: [] }

const GROUP_LABEL: Record<keyof SearchResults, string> = {
  clients:  'Клиенты',
  boats:    'Лодки',
  tasks:    'Задачи',
  quotes:   'Сметы',
  invoices: 'Счета',
}

function flatten(results: SearchResults): Hit[] {
  return (Object.keys(GROUP_LABEL) as (keyof SearchResults)[]).flatMap((k) => results[k])
}

export function GlobalSearch() {
  const router = useRouter()
  const { t } = useCrmI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Cmd/Ctrl-K — фокус в поиск из любого места экрана
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Клик снаружи — закрыть выпадающий список
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Debounce запроса к API
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(EMPTY)
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(() => {
      fetch(`/api/crm/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: SearchResults) => {
          setResults(data)
          setActiveIndex(-1)
        })
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  const hits = flatten(results)
  const hasQuery = query.trim().length >= 2

  const goTo = (hit: Hit) => {
    setOpen(false)
    setQuery('')
    setResults(EMPTY)
    inputRef.current?.blur()
    router.push(hit.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      goTo(hits[activeIndex])
    }
  }

  return (
    <div ref={rootRef} className="flex-1 max-w-lg relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 text-body select-none">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('search')}
          className="w-full bg-white/7 border border-white/10 rounded-control pl-8 pr-14 py-1.5 text-label text-white placeholder:text-white/45 focus:outline-none focus:border-white/20 focus:bg-white/10 transition"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-mono border border-white/15 rounded px-1.5 py-0.5 select-none pointer-events-none">
          ⌘K
        </span>
      </div>

      {open && hasQuery && (
        <div className="absolute left-0 top-full mt-1.5 w-[28rem] max-h-[28rem] overflow-y-auto bg-navy-900 border border-white/10 rounded-card shadow-e4 py-1.5 z-30">
          {loading && hits.length === 0 && (
            <p className="px-4 py-3 text-label text-white/40">Ищу…</p>
          )}
          {!loading && hits.length === 0 && (
            <p className="px-4 py-3 text-label text-white/40">Ничего не найдено</p>
          )}
          {(Object.keys(GROUP_LABEL) as (keyof SearchResults)[]).map((group) => {
            const groupHits = results[group]
            if (groupHits.length === 0) return null
            return (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-4 pt-2 pb-1 text-label text-white/35 uppercase tracking-wide">{GROUP_LABEL[group]}</p>
                {groupHits.map((hit) => {
                  const idx = hits.indexOf(hit)
                  return (
                    <button
                      key={hit.id}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => goTo(hit)}
                      className={
                        'w-full text-left px-4 py-2 flex items-center justify-between gap-3 transition ' +
                        (idx === activeIndex ? 'bg-white/10' : 'hover:bg-white/5')
                      }
                    >
                      <span className="text-body text-white truncate">{hit.label}</span>
                      {hit.sublabel && <span className="text-label text-white/40 shrink-0">{hit.sublabel}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
