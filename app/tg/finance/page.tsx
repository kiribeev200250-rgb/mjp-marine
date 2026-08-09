'use client'

import { useEffect, useState } from 'react'
import { useTg } from '@/components/tg/TgProvider'
import { TgShell } from '@/components/tg/TgShell'
import { TgCard, TgButton, TgInput, TgSelect, TgKpi, TgSpinner, TgEmpty } from '@/components/tg/ui'
import { formatMoney, isNegativeMoney, PAYMENT_METHODS } from '@/lib/crm/utils'
import type { FinanceEntryType } from '@prisma/client'

interface FinanceData {
  cash: string
  plMonth: string
  recent: {
    id: string
    autoId: string
    type: FinanceEntryType
    date: string
    category: string
    amount: string
    client: string | null
  }[]
}

const TYPE_LABELS: Record<FinanceEntryType, string> = { INCOME: 'Доход', EXPENSE: 'Расход', SALARY: 'Зарплата' }

export default function TgFinancePage() {
  const { ready, tgFetch, haptic } = useTg()
  const [data, setData] = useState<FinanceData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<FinanceEntryType>('EXPENSE')
  const [category, setCategory] = useState('')
  const [amountExpr, setAmountExpr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = () => {
    tgFetch('/api/tg/finance').then((r) => r.json()).then(setData).catch(() => setData(null))
  }

  useEffect(() => { if (ready) load() }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    const res = await tgFetch('/api/tg/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, category, amountExpr, paymentMethod }),
    })
    setBusy(false)
    if (res.ok) {
      haptic('medium')
      setShowForm(false)
      setCategory('')
      setAmountExpr('')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setMsg(d.error ?? 'Ошибка')
    }
  }

  return (
    <TgShell title="Финансы">
      {data === null ? (
        <TgSpinner />
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <TgKpi label="Касса" value={formatMoney(data.cash)} tone={isNegativeMoney(data.cash) ? 'danger' : 'default'} />
            <TgKpi label="P&L за месяц" value={formatMoney(data.plMonth)} tone={isNegativeMoney(data.plMonth) ? 'danger' : 'success'} />
          </div>

          <TgButton variant="secondary" className="w-full mb-3" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Отменить' : '+ Новая операция'}
          </TgButton>

          {showForm && (
            <TgCard className="flex flex-col gap-2 mb-3">
              <TgSelect
                value={type}
                onChange={(v) => setType(v as FinanceEntryType)}
                options={[
                  { value: 'INCOME', label: 'Доход' },
                  { value: 'EXPENSE', label: 'Расход' },
                  { value: 'SALARY', label: 'Зарплата' },
                ]}
              />
              <TgInput value={category} onChange={setCategory} placeholder="Категория" />
              <TgInput value={amountExpr} onChange={setAmountExpr} placeholder="Сумма (можно 168.23/2)" />
              <TgSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
              />
              {msg && <div className="text-xs text-danger">{msg}</div>}
              <TgButton variant="secondary" disabled={busy} onClick={submit}>
                {busy ? 'Сохраняю…' : 'Сохранить'}
              </TgButton>
            </TgCard>
          )}

          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 px-1">Последние операции</div>
          {data.recent.length === 0 ? (
            <TgEmpty text="Пока нет операций" />
          ) : (
            <div className="flex flex-col gap-2">
              {data.recent.map((e) => (
                <TgCard key={e.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-navy-900">{e.category}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {TYPE_LABELS[e.type]} · {new Date(e.date).toLocaleDateString('ru-RU')}
                      {e.client ? ` · ${e.client}` : ''}
                    </div>
                  </div>
                  <div className={'text-sm font-semibold tabular-nums ' + (e.type === 'INCOME' ? 'text-success' : 'text-danger')}>
                    {e.type === 'INCOME' ? '+' : '−'}{formatMoney(e.amount)}
                  </div>
                </TgCard>
              ))}
            </div>
          )}
        </>
      )}
    </TgShell>
  )
}
