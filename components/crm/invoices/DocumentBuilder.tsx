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

export interface BuilderInventoryItem {
  id:        string
  name:      string
  unit:      string
  sellPrice: string
}

interface MaterialLine {
  name: string
  quantity: string
  unitPrice: string
  inventoryItemId?: string
}

interface JobLine {
  title: string
  mode: 'fixed' | 'hours' | 'qty'
  laborHours: string
  laborRate: string
  quantity: string
  unitPrice: string
  laborCost: string
  materials: MaterialLine[]
}

interface Props {
  kind:             'invoice' | 'quote'
  clients:          BuilderClient[]
  inventoryItems:   BuilderInventoryItem[]
  defaultIvaRate:   string
  defaultIrpfRate:  string
  companyName:      string
  companyLocation:  string
  companyLogoUrl?:  string | null
  initialClientId?: string
}

const EMPTY_MATERIAL: MaterialLine = { name: '', quantity: '1', unitPrice: '' }
const EMPTY_JOB: JobLine = { title: '', mode: 'fixed', laborHours: '', laborRate: '', quantity: '', unitPrice: '', laborCost: '', materials: [] }

export function DocumentBuilder({
  kind, clients, inventoryItems, defaultIvaRate, defaultIrpfRate,
  companyName, companyLocation, companyLogoUrl, initialClientId,
}: Props) {
  const router = useRouter()
  const isInvoice = kind === 'invoice'

  const initialClient = clients.find((c) => c.id === initialClientId)
  const [clientId,     setClientId]     = useState(initialClientId ?? '')
  const [clientSearch, setClientSearch] = useState(
    initialClient ? `${initialClient.firstName} ${initialClient.lastName}` : '',
  )
  const [language,     setLanguage]     = useState(initialClient?.language || 'ru')
  const [jobs,          setJobs]         = useState<JobLine[]>([{ ...EMPTY_JOB, materials: [] }])
  const [matSearch,     setMatSearch]    = useState<{ job: number; mat: number } | null>(null)
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

  function updateJob(i: number, patch: Partial<JobLine>) {
    setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, ...patch } : j)))
  }
  function addJob() {
    setJobs((prev) => [...prev, { ...EMPTY_JOB, materials: [] }])
  }
  function removeJob(i: number) {
    setJobs((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  function updateMaterial(ji: number, mi: number, patch: Partial<MaterialLine>) {
    setJobs((prev) => prev.map((j, idx) => (
      idx !== ji ? j : { ...j, materials: j.materials.map((m, midx) => (midx === mi ? { ...m, ...patch } : m)) }
    )))
  }
  function addMaterial(ji: number) {
    setJobs((prev) => prev.map((j, idx) => (idx !== ji ? j : { ...j, materials: [...j.materials, { ...EMPTY_MATERIAL }] })))
  }
  function removeMaterial(ji: number, mi: number) {
    setJobs((prev) => prev.map((j, idx) => (idx !== ji ? j : { ...j, materials: j.materials.filter((_, midx) => midx !== mi) })))
  }
  function pickInventoryItem(ji: number, mi: number, item: BuilderInventoryItem) {
    updateMaterial(ji, mi, { name: item.name, unitPrice: item.sellPrice, inventoryItemId: item.id })
    setMatSearch(null)
  }

  const computed = useMemo(() => {
    const jobRows = jobs.map((j) => {
      const matRows = j.materials.map((m) => {
        const qty   = new Decimal(m.quantity || 0)
        const price = new Decimal(m.unitPrice || 0)
        return { ...m, total: qty.times(price) }
      })
      const materialsSum = matRows.reduce((s, m) => s.plus(m.total), new Decimal(0))
      const laborCostDec = j.mode === 'hours'
        ? new Decimal(j.laborHours || 0).times(new Decimal(j.laborRate || 0))
        : j.mode === 'qty'
        ? new Decimal(j.quantity || 0).times(new Decimal(j.unitPrice || 0))
        : new Decimal(j.laborCost || 0)
      return { ...j, materials: matRows, laborCostDec, materialsSum }
    })
    const jobsTotal      = jobRows.reduce((s, j) => s.plus(j.laborCostDec), new Decimal(0))
    const materialsTotal = jobRows.reduce((s, j) => s.plus(j.materialsSum), new Decimal(0))
    const subtotal   = jobsTotal.plus(materialsTotal)
    const iva        = new Decimal(ivaRate || 0)
    const irpf       = new Decimal(isInvoice ? irpfRate || 0 : 0)
    const ivaAmount  = subtotal.times(iva).div(100)
    const irpfAmount = subtotal.times(irpf).div(100)
    const total       = subtotal.plus(ivaAmount).minus(irpfAmount)
    return { jobRows, jobsTotal, materialsTotal, subtotal, ivaAmount, irpfAmount, total }
  }, [jobs, ivaRate, irpfRate, isInvoice])

  async function handleSubmit() {
    setError(null)
    if (!clientId) { setError('Выберите клиента'); return }

    const cleanJobs = jobs
      .filter((j) => j.title.trim())
      .map((j) => ({
        title: j.title.trim(),
        laborHours: j.mode === 'hours' ? (j.laborHours || '0') : undefined,
        laborRate:  j.mode === 'hours' ? (j.laborRate  || '0') : undefined,
        quantity:   j.mode === 'qty'   ? (j.quantity   || '0') : undefined,
        unitPrice:  j.mode === 'qty'   ? (j.unitPrice  || '0') : undefined,
        laborCost:  j.mode === 'fixed' ? (j.laborCost  || '0') : '0',
        materials: j.materials
          .filter((m) => m.name.trim() && Number(m.unitPrice) >= 0 && Number(m.quantity) > 0)
          .map((m) => ({ name: m.name.trim(), quantity: m.quantity, unitPrice: m.unitPrice, inventoryItemId: m.inventoryItemId })),
      }))

    if (cleanJobs.length === 0) { setError('Добавьте хотя бы одну работу'); return }

    setSaving(true)
    const endpoint = isInvoice ? '/api/crm/invoices' : '/api/crm/quotes'
    const payload = isInvoice
      ? { clientId, language, dueDate: dueDate || undefined, ivaRate, irpfRate, paymentMethod, notes, jobs: cleanJobs }
      : { clientId, language, validUntil: validUntil || undefined, ivaRate, notes, jobs: cleanJobs }

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
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_440px] gap-5 items-start">
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
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-control shadow-e2">
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

        {/* Работы */}
        <div className="space-y-3">
          <label className="block text-label text-gray-500 uppercase tracking-wide">Работы и материалы</label>

          {jobs.map((job, ji) => (
            <div key={ji} className="border border-gray-200 rounded-control p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="w-5 text-label text-gray-500 font-semibold shrink-0">{ji + 1}</span>
                <input
                  className="flex-1 rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                  placeholder="Название работы"
                  value={job.title}
                  onChange={(e) => updateJob(ji, { title: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeJob(ji)}
                  className="text-gray-200 hover:text-danger transition shrink-0 w-5"
                  title="Удалить работу"
                >
                  ✕
                </button>
              </div>

              {/* Расчёт стоимости труда: фиксированная сумма ИЛИ часы × ставка */}
              <div className="pl-7 flex items-center gap-2 flex-wrap">
                <div className="flex rounded-control overflow-hidden border border-gray-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateJob(ji, { mode: 'fixed' })}
                    className={`px-2.5 py-1.5 text-label font-medium transition ${
                      job.mode === 'fixed' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Сумма
                  </button>
                  <button
                    type="button"
                    onClick={() => updateJob(ji, { mode: 'hours' })}
                    className={`px-2.5 py-1.5 text-label font-medium transition ${
                      job.mode === 'hours' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Часы × ставка
                  </button>
                  <button
                    type="button"
                    onClick={() => updateJob(ji, { mode: 'qty' })}
                    className={`px-2.5 py-1.5 text-label font-medium transition ${
                      job.mode === 'qty' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Кол-во × цена
                  </button>
                </div>

                {job.mode === 'fixed' ? (
                  <input
                    type="number" min="0" step="0.01"
                    className="w-32 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                    placeholder="Стоимость работы, €"
                    value={job.laborCost}
                    onChange={(e) => updateJob(ji, { laborCost: e.target.value })}
                  />
                ) : job.mode === 'hours' ? (
                  <>
                    <input
                      type="number" min="0" step="0.5"
                      className="w-16 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      placeholder="Часы"
                      value={job.laborHours}
                      onChange={(e) => updateJob(ji, { laborHours: e.target.value })}
                    />
                    <span className="text-gray-300 text-label">×</span>
                    <input
                      type="number" min="0" step="0.01"
                      className="w-20 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      placeholder="€/час"
                      value={job.laborRate}
                      onChange={(e) => updateJob(ji, { laborRate: e.target.value })}
                    />
                    <span className="text-gray-300 text-label">=</span>
                    <span className="text-body font-semibold text-gray-900 tabular-nums">
                      {formatMoney(computed.jobRows[ji]?.laborCostDec ?? 0)}
                    </span>
                  </>
                ) : (
                  <>
                    <input
                      type="number" min="0" step="1"
                      className="w-16 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      placeholder="Кол-во"
                      value={job.quantity}
                      onChange={(e) => updateJob(ji, { quantity: e.target.value })}
                    />
                    <span className="text-gray-300 text-label">×</span>
                    <input
                      type="number" min="0" step="0.01"
                      className="w-20 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      placeholder="Цена, €"
                      value={job.unitPrice}
                      onChange={(e) => updateJob(ji, { unitPrice: e.target.value })}
                    />
                    <span className="text-gray-300 text-label">=</span>
                    <span className="text-body font-semibold text-gray-900 tabular-nums">
                      {formatMoney(computed.jobRows[ji]?.laborCostDec ?? 0)}
                    </span>
                  </>
                )}
              </div>

              {/* Материалы работы */}
              <div className="pl-7 space-y-1.5">
                {job.materials.map((mat, mi) => (
                  <div key={mi} className="flex items-center gap-2 relative">
                    <span className="w-9 text-label text-gray-500 shrink-0">{ji + 1}.{mi + 1}</span>
                    <input
                      className="flex-1 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      placeholder="Материал: поиск по складу или ручной ввод"
                      value={mat.name}
                      onChange={(e) => {
                        updateMaterial(ji, mi, { name: e.target.value, inventoryItemId: undefined })
                        setMatSearch({ job: ji, mat: mi })
                      }}
                      onFocus={() => setMatSearch({ job: ji, mat: mi })}
                      onBlur={() => setTimeout(() => setMatSearch(null), 150)}
                    />
                    <input
                      type="number" min="0" step="0.001"
                      className="w-16 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      value={mat.quantity}
                      onChange={(e) => updateMaterial(ji, mi, { quantity: e.target.value })}
                    />
                    <input
                      type="number" min="0" step="0.01"
                      className="w-20 rounded-control border border-gray-200 bg-white px-2 py-1.5 text-body text-gray-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
                      placeholder="Цена"
                      value={mat.unitPrice}
                      onChange={(e) => updateMaterial(ji, mi, { unitPrice: e.target.value })}
                    />
                    <span className="w-16 text-label text-gray-900 text-right tabular-nums shrink-0">
                      {formatMoney(computed.jobRows[ji]?.materials[mi]?.total ?? 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMaterial(ji, mi)}
                      className="text-gray-200 hover:text-danger transition shrink-0 w-4"
                      title="Удалить материал"
                    >
                      ✕
                    </button>

                    {matSearch?.job === ji && matSearch?.mat === mi && mat.name.trim() && (
                      <div className="absolute z-20 top-full mt-1 left-9 right-16 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-control shadow-e2">
                        {inventoryItems
                          .filter((it) => it.name.toLowerCase().includes(mat.name.trim().toLowerCase()))
                          .slice(0, 20)
                          .map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-label hover:bg-gray-50 transition flex justify-between"
                              onMouseDown={() => pickInventoryItem(ji, mi, it)}
                            >
                              <span className="text-gray-900">{it.name}</span>
                              <span className="text-gray-500 tabular-nums">{formatMoney(it.sellPrice)}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addMaterial(ji)} className="text-info text-label font-medium hover:underline">
                  + Материал
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addJob} className="text-info text-body font-medium hover:underline">
            + Работа
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
          <div className="flex items-center gap-3">
            {companyLogoUrl && (
              <div className="w-14 h-14 rounded-lg bg-white border border-white/20 shrink-0 flex items-center justify-center overflow-hidden p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={companyLogoUrl} alt={companyName} className="max-w-full max-h-full object-contain" />
              </div>
            )}
            <div>
              <p className="text-white font-bold text-subheading">{companyName}</p>
              <p className="text-white/50 text-label mt-0.5">{companyLocation}</p>
            </div>
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

          <div className="border border-white/10 rounded-control overflow-hidden">
            <div className="flex text-white/50 text-[9px] uppercase tracking-wide py-1.5 bg-white/5 border-b-2 border-b-gold/60 gap-0.5">
              <span className="w-5 pl-2 border-r border-white/10">№</span>
              <span className="flex-1 pl-1 border-r border-white/10">Description</span>
              <span className="w-8 text-right border-r border-white/10">Hrs</span>
              <span className="w-10 text-right border-r border-white/10">Rate</span>
              <span className="w-8 text-right border-r border-white/10">Qty</span>
              <span className="w-10 text-right border-r border-white/10">Price</span>
              <span className="w-14 text-right pr-2">Total</span>
            </div>
            {computed.jobRows.filter((j) => j.title.trim()).length === 0 ? (
              <p className="text-white/30 text-label py-4 text-center">Нет позиций</p>
            ) : computed.jobRows.filter((j) => j.title.trim()).map((j, ji) => (
              <div key={ji}>
                <div className="flex items-center py-1.5 border-b border-white/10 border-l-2 border-l-gold text-[11px] bg-white/[0.03] gap-0.5">
                  <span className="w-5 pl-1.5 text-gold font-semibold tabular-nums border-r border-white/10">{ji + 1}</span>
                  <span className="flex-1 pl-1 text-white font-semibold truncate pr-1 border-r border-white/10">{j.title}</span>
                  <span className={`w-8 text-right tabular-nums border-r border-white/10 ${j.mode === 'hours' ? 'text-white/70' : 'text-white/25'}`}>{j.mode === 'hours' ? (j.laborHours || '0') : '—'}</span>
                  <span className={`w-10 text-right tabular-nums border-r border-white/10 ${j.mode === 'hours' ? 'text-white/70' : 'text-white/25'}`}>{j.mode === 'hours' ? formatMoney(j.laborRate || 0) : '—'}</span>
                  <span className={`w-8 text-right tabular-nums border-r border-white/10 ${j.mode === 'qty' ? 'text-white/70' : 'text-white/25'}`}>{j.mode === 'qty' ? (j.quantity || '0') : '—'}</span>
                  <span className={`w-10 text-right tabular-nums border-r border-white/10 ${j.mode === 'qty' ? 'text-white/70' : 'text-white/25'}`}>{j.mode === 'qty' ? formatMoney(j.unitPrice || 0) : '—'}</span>
                  <span className="w-14 text-right text-white font-semibold tabular-nums pr-2">{formatMoney(j.laborCostDec)}</span>
                </div>
                {j.materials.filter((m) => m.name.trim()).map((m, mi) => (
                  <div key={mi} className="flex items-center py-1.5 border-b border-white/10 border-l-2 border-l-transparent text-[11px] gap-0.5">
                    <span className="w-5 pl-1.5 text-white/40 text-[9px] tabular-nums shrink-0 border-r border-white/10">·</span>
                    <span className="flex-1 pl-4 text-white/80 truncate pr-1 border-r border-white/10">{m.name}</span>
                    <span className="w-8 text-right text-white/25 tabular-nums border-r border-white/10">—</span>
                    <span className="w-10 text-right text-white/25 tabular-nums border-r border-white/10">—</span>
                    <span className="w-8 text-right text-white/70 tabular-nums border-r border-white/10">{m.quantity}</span>
                    <span className="w-10 text-right text-white/70 tabular-nums border-r border-white/10">{formatMoney(m.unitPrice || 0)}</span>
                    <span className="w-14 text-right text-white/90 tabular-nums pr-2">{formatMoney(m.total)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="border border-white/10 rounded-control overflow-hidden">
            <div className="flex justify-between text-body px-3 py-1.5 border-b border-white/10">
              <span className="text-white/50">Итого работа</span>
              <span className="text-white tabular-nums">{formatMoney(computed.jobsTotal)}</span>
            </div>
            <div className="flex justify-between text-body px-3 py-1.5 border-b border-white/10">
              <span className="text-white/50">Итого материалы</span>
              <span className="text-white tabular-nums">{formatMoney(computed.materialsTotal)}</span>
            </div>
            <div className="flex justify-between text-body px-3 py-1.5 border-b border-white/10">
              <span className="text-white/50">Subtotal</span>
              <span className="text-white tabular-nums">{formatMoney(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between text-body px-3 py-1.5 border-b border-white/10">
              <span className="text-white/50">IVA ({ivaRate || 0}%)</span>
              <span className="text-white tabular-nums">{formatMoney(computed.ivaAmount)}</span>
            </div>
            {isInvoice && new Decimal(irpfRate || 0).gt(0) && (
              <div className="flex justify-between text-body px-3 py-1.5 border-b border-white/10">
                <span className="text-white/50">IRPF ({irpfRate}%)</span>
                <span className="text-white tabular-nums">−{formatMoney(computed.irpfAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-3 py-2.5 bg-white/5 border-t-2 border-t-gold">
              <span className="text-gold font-bold text-label uppercase tracking-wide">Total</span>
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
