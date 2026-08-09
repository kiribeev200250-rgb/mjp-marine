'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Button, Input, Select } from '@/components/crm/ui'
import { formatMoney, PAYMENT_METHODS, LANGUAGE_LABELS } from '@/lib/crm/utils'

export interface BuilderClient {
  id:        string
  firstName: string
  lastName:  string
  phone:     string
  marina:    string
  language:  string
}

interface LineItem { description: string; quantity: string; unitPrice: string }

interface Props {
  kind:            'invoice' | 'quote'
  clients:         BuilderClient[]
  defaultIvaRate:  string
  defaultIrpfRate: string
  companyName:     string
  companyLocation: string
  initialClientId?: string
}

const EMPTY_ITEM: LineItem = { description: '', quantity: '1', unitPrice: '' }

export function DocumentBuilder({
  kind, clients, defaultIvaRate, defaultIrpfRate, companyName, companyLocation, initialClientId,
}: Props) {
  const router = useRouter()
  const isInvoice = kind === 'invoice'

  const initialClient = clients.find((c) => c.id === initialClientId)
  const [clientId,     setClientId]     = useState(initialClientId ?? '')
  const [clientSearch, setClientSearch] = useState(
    initialClient ? `${initialClient.firstName} ${initialClient.lastName}` : '',
  )
  const [language,     setLanguage]     = useState(initialClient?.language || 'ru')
  const [items,        setItems]        = useState<LineItem[]>([{ ...EMPTY_ITEM }])
  const [ivaRate,       setIvaRate]      = useState(defaultIvaRate)
  const [irpfRate,      setIrpfRate]     = useState(defaultIrpfRate)
  const [dueDate,       setDueDate]      = useState('')
  const [validUntil,    setValidUntil]   = useState('')
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [notes,         setNotes]        = useState('')
  const [saving,        setSaving]       = useState(false)
  const [error,         setError]        = useState<string | null>(null)

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 30)
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.phone.includes(q),
    ).slice(0, 30)
  }, [clients, clientSearch])

  const selectedClient = clients.find((c) => c.id === clientId)

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  const computed = useMemo(() => {
    const rows = items.map((it) => {
      const qty   = new Decimal(it.quantity || 0)
      const price = new Decimal(it.unitPrice || 0)
      return { ...it, total: qty.times(price) }
    })
    const subtotal   = rows.reduce((s, r) => s.plus(r.total), new Decimal(0))
    const iva        = new Decimal(ivaRate || 0)
    const irpf       = new Decimal(isInvoice ? irpfRate || 0 : 0)
    const ivaAmount  = subtotal.times(iva).div(100)
    const irpfAmount = subtotal.times(irpf).div(100)
    const total       = subtotal.plus(ivaAmount).minus(irpfAmount)
    return { rows, subtotal, ivaAmount, irpfAmount, total }
  }, [items, ivaRate, irpfRate, isInvoice])

  async function handleSubmit() {
    setError(null)
    if (!clientId) { setError('Выберите клиента'); return }
    const cleanItems = items.filter((it) => it.description.trim() && Number(it.unitPrice) > 0)
    if (cleanItems.length === 0) { setError('Добавьте хотя бы одну позицию с ценой'); return }

    setSaving(true)
    const endpoint = isInvoice ? '/api/crm/invoices' : '/api/crm/quotes'
    const payload = isInvoice
      ? { clientId, language, dueDate: dueDate || undefined, ivaRate, irpfRate, paymentMethod, notes, items: cleanItems }
      : { clientId, language, validUntil: validUntil || undefined, ivaRate, notes, items: cleanItems }

    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    setSaving(false)

    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка сохранения')
      return
    }
    const doc = await res.json()
    router.push(isInvoice ? `/crm/invoices/${doc.id}` : `/crm/invoices/quote/${doc.id}`)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
      {/* Форма */}
      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-5 space-y-5">
        <h2 className="text-subheading font-bold text-gray-900">
          {isInvoice ? 'Конструктор счёта' : 'Конструктор пресмета'}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 relative">
            <label className="block text-label text-gray-500 uppercase tracking-wide">Клиент</label>
            <Input
              placeholder="Поиск клиента…"
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setClientId('') }}
            />
            {clientSearch && !clientId && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-control shadow-e2">
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-2 text-label text-gray-500">Не найдено</p>
                ) : filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-body hover:bg-gray-50 transition"
                    onClick={() => {
                      setClientId(c.id)
                      setClientSearch(`${c.firstName} ${c.lastName}`)
                      if (c.language) setLanguage(c.language)
                    }}
                  >
                    <span className="text-gray-900 font-medium">{c.firstName} {c.lastName}</span>
                    {c.marina && <span className="text-gray-500 text-label"> · {c.marina}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Select label="Язык" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </Select>
        </div>

        {/* Позиции */}
        <div className="space-y-2">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Позиции</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                  placeholder="Описание работы / товара"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                />
                <input
                  type="number" min="0" step="0.01"
                  className="w-20 rounded-control border border-gray-200 bg-white px-2 py-2 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                />
                <input
                  type="number" min="0" step="0.01"
                  className="w-24 rounded-control border border-gray-200 bg-white px-2 py-2 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                  placeholder="Цена"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                />
                <span className="w-20 text-body text-gray-900 text-right tabular-nums shrink-0">
                  {formatMoney(computed.rows[i]?.total ?? 0)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-gray-200 hover:text-danger transition shrink-0 w-5"
                  title="Удалить позицию"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-info text-body font-medium hover:underline">
            + Добавить позицию
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="IVA %" type="number" min="0" step="0.01" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} />
          {isInvoice ? (
            <>
              <Input label="IRPF %" type="number" min="0" step="0.01" value={irpfRate} onChange={(e) => setIrpfRate(e.target.value)} />
              <Input label="Срок оплаты" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </>
          ) : (
            <Input label="Действителен до" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          )}
        </div>

        {isInvoice && (
          <Select label="Способ оплаты" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        )}

        <div className="space-y-1">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Примечания</label>
          <textarea
            className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-danger text-label">{error}</div>
        )}

        <Button onClick={handleSubmit} loading={saving} className="w-full justify-center">
          {isInvoice ? 'Создать счёт' : 'Создать пресмет'}
        </Button>
      </div>

      {/* Живой предпросмотр */}
      <div className="bg-navy-900 rounded-card shadow-e2 overflow-hidden sticky top-5">
        <div className="p-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-subheading">{companyName}</p>
            <p className="text-white/50 text-label mt-0.5">{companyLocation}</p>
          </div>
          <div className="text-right">
            <p className="text-gold text-label font-bold uppercase tracking-wide">
              {isInvoice ? 'Invoice' : 'Quote'}
            </p>
            <p className="text-white/50 text-label">черновик</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wide">Bill to</p>
              <p className="text-white font-semibold text-body">{selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-[10px] uppercase tracking-wide">Date</p>
              <p className="text-white text-body">{new Date().toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          <div>
            <div className="flex text-white/40 text-[10px] uppercase tracking-wide pb-1.5 border-b border-white/10">
              <span className="flex-1">Description</span>
              <span className="w-10 text-right">Qty</span>
              <span className="w-16 text-right">Price</span>
              <span className="w-20 text-right">Total</span>
            </div>
            {computed.rows.filter((r) => r.description.trim()).length === 0 ? (
              <p className="text-white/30 text-label py-4 text-center">Нет позиций</p>
            ) : computed.rows.filter((r) => r.description.trim()).map((r, i) => (
              <div key={i} className="flex items-center py-1.5 border-b border-white/5 text-body">
                <span className="flex-1 text-white/90 truncate pr-2">{r.description}</span>
                <span className="w-10 text-right text-white/70 tabular-nums">{r.quantity}</span>
                <span className="w-16 text-right text-white/70 tabular-nums">{formatMoney(r.unitPrice || 0)}</span>
                <span className="w-20 text-right text-white font-medium tabular-nums">{formatMoney(r.total)}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-1.5">
            <div className="flex justify-between text-body">
              <span className="text-white/50">Subtotal</span>
              <span className="text-white tabular-nums">{formatMoney(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-white/50">IVA ({ivaRate || 0}%)</span>
              <span className="text-white tabular-nums">{formatMoney(computed.ivaAmount)}</span>
            </div>
            {isInvoice && new Decimal(irpfRate || 0).gt(0) && (
              <div className="flex justify-between text-body">
                <span className="text-white/50">IRPF ({irpfRate}%)</span>
                <span className="text-white tabular-nums">−{formatMoney(computed.irpfAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 mt-1 border-t border-white/15">
              <span className="text-gold font-bold text-subheading">Total</span>
              <span className="text-gold font-bold text-subheading tabular-nums">{formatMoney(computed.total)}</span>
            </div>
          </div>

          <p className="text-white/30 text-[10px] pt-2 border-t border-white/5">
            {isInvoice ? `Payment method: ${paymentMethod}` : `Valid until: ${validUntil || '—'}`} · Language: {LANGUAGE_LABELS[language]?.replace(/^\S+\s/, '') ?? language}
          </p>
        </div>
      </div>
    </div>
  )
}
