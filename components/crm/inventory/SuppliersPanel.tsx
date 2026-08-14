'use client'

import { useEffect, useState } from 'react'
import { Button, Card, SectionHeader, Input, Select, Badge } from '@/components/crm/ui'
import { formatMoney } from '@/lib/crm/utils'

interface Supplier {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  active: boolean
  _count: { items: number; bills: number }
}

interface InventoryItemOption {
  id: string
  name: string
  unit: string
}

type BillStatus = 'ORDERED' | 'RECEIVED' | 'PAID' | 'CANCELLED'

interface Bill {
  id: string
  description: string
  qty: string
  amount: string
  vatAmount: string
  total: string
  status: BillStatus
  orderedAt: string
  supplier: { id: string; name: string }
  task: { id: string; title: string } | null
  client: { id: string; firstName: string; lastName: string } | null
  item: { id: string; name: string; unit: string } | null
}

const STATUS_LABEL: Record<BillStatus, string> = {
  ORDERED: 'Заказано',
  RECEIVED: 'Принято',
  PAID: 'Оплачено',
  CANCELLED: 'Отменено',
}

const STATUS_TONE: Record<BillStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  ORDERED: 'warning',
  RECEIVED: 'info',
  PAID: 'success',
  CANCELLED: 'neutral',
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

export function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [bills, setBills] = useState<Bill[] | null>(null)
  const [items, setItems] = useState<InventoryItemOption[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supName, setSupName] = useState('')
  const [supContact, setSupContact] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierError, setSupplierError] = useState<string | null>(null)

  const [showBillForm, setShowBillForm] = useState(false)
  const [billSupplierId, setBillSupplierId] = useState('')
  const [billItemId, setBillItemId] = useState('')
  const [billDescription, setBillDescription] = useState('')
  const [billQty, setBillQty] = useState('1')
  const [billAmount, setBillAmount] = useState('')
  const [billHasVat, setBillHasVat] = useState(true)
  const [billVatRate, setBillVatRate] = useState('21')
  const [savingBill, setSavingBill] = useState(false)
  const [billError, setBillError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'' | BillStatus>('')

  const loadSuppliers = () => fetch('/api/crm/suppliers').then((r) => r.json()).then(setSuppliers)
  const loadBills = (status: '' | BillStatus) =>
    fetch(`/api/crm/supplier-bills${status ? `?status=${status}` : ''}`).then((r) => r.json()).then(setBills)

  useEffect(() => {
    loadSuppliers()
    loadBills('')
    fetch('/api/crm/inventory')
      .then((r) => r.json())
      .then((data: { id: string; name: string; unit: string }[]) => {
        setItems(data.map((it) => ({ id: it.id, name: it.name, unit: it.unit })))
      })
      .catch(() => setItems([]))
  }, [])

  useEffect(() => { loadBills(statusFilter) }, [statusFilter])

  const createSupplier = async () => {
    setSupplierError(null)
    if (!supName.trim()) { setSupplierError('Укажите название'); return }
    setSavingSupplier(true)
    const res = await fetch('/api/crm/suppliers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: supName, contactName: supContact, phone: supPhone, email: supEmail }),
    })
    setSavingSupplier(false)
    if (res.ok) {
      setShowSupplierForm(false)
      setSupName(''); setSupContact(''); setSupPhone(''); setSupEmail('')
      loadSuppliers()
    } else {
      const d = await res.json().catch(() => ({}))
      setSupplierError(d.error ?? 'Ошибка')
    }
  }

  const createBill = async () => {
    setBillError(null)
    if (!billSupplierId) { setBillError('Выберите поставщика'); return }
    if (!billDescription.trim()) { setBillError('Укажите описание'); return }
    if (!billAmount || Number(billAmount) <= 0) { setBillError('Укажите сумму'); return }
    setSavingBill(true)
    const res = await fetch('/api/crm/supplier-bills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: billSupplierId, itemId: billItemId || undefined,
        description: billDescription, qty: billQty, amount: billAmount,
        hasVat: billHasVat, vatRate: billVatRate,
      }),
    })
    setSavingBill(false)
    if (res.ok) {
      setShowBillForm(false)
      setBillSupplierId(''); setBillItemId(''); setBillDescription(''); setBillQty('1'); setBillAmount('')
      loadBills(statusFilter)
      loadSuppliers()
    } else {
      const d = await res.json().catch(() => ({}))
      setBillError(d.error ?? 'Ошибка')
    }
  }

  const receive = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/crm/supplier-bills/${id}/receive`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) loadBills(statusFilter)
  }

  const pay = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/crm/supplier-bills/${id}/pay`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) loadBills(statusFilter)
    else {
      const d = await res.json().catch(() => ({}))
      if (d.error) alert(d.error)
    }
  }

  const cancel = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/crm/supplier-bills/${id}`, { method: 'DELETE' })
    setBusyId(null)
    if (res.ok) loadBills(statusFilter)
    else {
      const d = await res.json().catch(() => ({}))
      if (d.error) alert(d.error)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader
          title="Поставщики"
          action={<Button size="sm" variant="secondary" onClick={() => setShowSupplierForm((v) => !v)}>{showSupplierForm ? 'Отменить' : '+ Поставщик'}</Button>}
        />

        {showSupplierForm && (
          <div className="mb-4 p-4 border border-gray-200 rounded-control space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Название" value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="Например, Yanmar Iberia" />
              <Input label="Контактное лицо" value={supContact} onChange={(e) => setSupContact(e.target.value)} placeholder="Необязательно" />
              <Input label="Телефон" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} placeholder="Необязательно" />
              <Input label="Email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} placeholder="Необязательно" />
            </div>
            {supplierError && <p className="text-body text-danger">{supplierError}</p>}
            <Button disabled={savingSupplier} onClick={createSupplier}>{savingSupplier ? 'Сохраняю…' : 'Создать поставщика'}</Button>
          </div>
        )}

        {suppliers === null ? (
          <p className="text-body text-gray-500">Загрузка…</p>
        ) : suppliers.length === 0 ? (
          <p className="text-body text-gray-500 text-center py-4">Поставщиков пока нет</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-body text-gray-900 font-medium">{s.name}</p>
                  <p className="text-label text-gray-500">
                    {[s.contactName, s.phone, s.email].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="shrink-0 text-label text-gray-500">
                  {s._count.items} товаров · {s._count.bills} заказов
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Заказы у поставщиков (кредиторка)"
          action={<Button size="sm" variant="secondary" onClick={() => setShowBillForm((v) => !v)}>{showBillForm ? 'Отменить' : '+ Новый заказ'}</Button>}
        />

        {showBillForm && (
          <div className="mb-4 p-4 border border-gray-200 rounded-control space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Поставщик" value={billSupplierId} onChange={(e) => setBillSupplierId(e.target.value)}>
                <option value="">— выберите —</option>
                {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select label="Товар со склада" value={billItemId} onChange={(e) => setBillItemId(e.target.value)}>
                <option value="">Не привязывать (услуга/прочее)</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}
              </Select>
              <Input label="Описание" value={billDescription} onChange={(e) => setBillDescription(e.target.value)} placeholder="Что заказано" className="col-span-2" />
              <Input label="Количество" type="number" min={0} value={billQty} onChange={(e) => setBillQty(e.target.value)} />
              <Input label="Сумма (нетто)" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="0.00" suffix="€" />
              <Select label="IVA" value={billHasVat ? '1' : '0'} onChange={(e) => setBillHasVat(e.target.value === '1')}>
                <option value="1">С IVA</option>
                <option value="0">Без IVA</option>
              </Select>
              {billHasVat && (
                <Input label="Ставка IVA, %" type="number" min={0} max={100} value={billVatRate} onChange={(e) => setBillVatRate(e.target.value)} />
              )}
            </div>
            {billError && <p className="text-body text-danger">{billError}</p>}
            <Button disabled={savingBill} onClick={createBill}>{savingBill ? 'Сохраняю…' : 'Создать заказ'}</Button>
          </div>
        )}

        <div className="mb-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | BillStatus)} className="w-48">
            <option value="">Все статусы</option>
            <option value="ORDERED">Заказано</option>
            <option value="RECEIVED">Принято</option>
            <option value="PAID">Оплачено</option>
            <option value="CANCELLED">Отменено</option>
          </Select>
        </div>

        {bills === null ? (
          <p className="text-body text-gray-500">Загрузка…</p>
        ) : bills.length === 0 ? (
          <p className="text-body text-gray-500 text-center py-4">Заказов нет</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                    <p className="text-body text-gray-900 font-medium truncate">{b.description}</p>
                  </div>
                  <p className="text-label text-gray-500">
                    {b.supplier.name} · {fmtDate(b.orderedAt)}
                    {b.item && ` · ${b.item.name} ×${b.qty} ${b.item.unit}`}
                    {b.task && ` · задача «${b.task.title}»`}
                    {b.client && ` · ${b.client.firstName} ${b.client.lastName}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-body font-semibold tabular-nums text-gray-900">{formatMoney(b.total)}</span>
                  {b.status === 'ORDERED' && (
                    <>
                      <Button size="sm" disabled={busyId === b.id} onClick={() => receive(b.id)}>Принять</Button>
                      <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => cancel(b.id)}>Отменить</Button>
                    </>
                  )}
                  {b.status === 'RECEIVED' && (
                    <>
                      <Button size="sm" disabled={busyId === b.id} onClick={() => pay(b.id)}>Оплатить</Button>
                      <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => cancel(b.id)}>Отменить</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
