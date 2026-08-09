'use client'

import { useEffect, useState } from 'react'
import { useTg } from '@/components/tg/TgProvider'
import { TgShell } from '@/components/tg/TgShell'
import { TgCard, TgButton, TgInput, TgSpinner, TgEmpty } from '@/components/tg/ui'
import { Badge } from '@/components/crm/ui/Badge'
import { formatMoney } from '@/lib/crm/utils'

interface Item {
  id: string
  name: string
  unit: string
  qtyInStock: string
  qtyMinAlert: string
  sellPrice: string
  costPrice: string
  lowStock: boolean
}

type MoveType = 'RECEIVE' | 'WRITE_OFF' | 'SELL'

export default function TgWarehousePage() {
  const { ready, tgFetch, haptic } = useTg()
  const [items, setItems] = useState<Item[] | null>(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [moveType, setMoveType] = useState<MoveType>('WRITE_OFF')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = (search: string) => {
    const url = search ? `/api/tg/warehouse?q=${encodeURIComponent(search)}` : '/api/tg/warehouse'
    tgFetch(url).then((r) => r.json()).then(setItems).catch(() => setItems([]))
  }

  useEffect(() => { if (ready) load(q) }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const submitMove = async (item: Item) => {
    setBusy(true)
    setMsg(null)
    const res = await tgFetch(`/api/tg/warehouse/${item.id}/movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: moveType, qty }),
    })
    setBusy(false)
    if (res.ok) {
      haptic('medium')
      setOpenId(null)
      setQty('1')
      load(q)
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error ?? 'Ошибка')
    }
  }

  return (
    <TgShell title="Склад">
      <TgInput value={q} onChange={setQ} placeholder="Поиск по названию…" className="mb-3" />

      {items === null ? (
        <TgSpinner />
      ) : items.length === 0 ? (
        <TgEmpty text="Ничего не найдено" />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <TgCard key={item.id} className="flex flex-col gap-2">
              <div
                className="flex items-start justify-between gap-2"
                onClick={() => { setOpenId(openId === item.id ? null : item.id); setMsg(null) }}
              >
                <div>
                  <div className="font-semibold text-navy-900 text-sm">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    {item.qtyInStock} {item.unit} · продажа {formatMoney(item.sellPrice)}
                  </div>
                </div>
                {item.lowStock && <Badge tone="danger">Низкий остаток</Badge>}
              </div>

              {openId === item.id && (
                <div className="border-t border-gray-100 pt-2 flex flex-col gap-2">
                  <div className="flex gap-1.5">
                    {(['RECEIVE', 'WRITE_OFF', 'SELL'] as MoveType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setMoveType(t)}
                        className={
                          'flex-1 rounded-control py-1.5 text-xs font-semibold ' +
                          (moveType === t ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500')
                        }
                      >
                        {t === 'RECEIVE' ? 'Приход' : t === 'WRITE_OFF' ? 'Списание' : 'Продажа'}
                      </button>
                    ))}
                  </div>
                  <TgInput value={qty} onChange={setQty} type="number" placeholder={`Количество, ${item.unit}`} />
                  {msg && <div className="text-xs text-danger">{msg}</div>}
                  <TgButton variant="secondary" disabled={busy} onClick={() => submitMove(item)}>
                    {busy ? 'Сохраняю…' : 'Подтвердить'}
                  </TgButton>
                </div>
              )}
            </TgCard>
          ))}
        </div>
      )}
    </TgShell>
  )
}
