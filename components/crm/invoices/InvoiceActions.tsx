'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/crm/ui'
import { RefundModal } from './RefundModal'
import type { InvoiceStatus } from '@prisma/client'

interface Props {
  id:          string
  status:      InvoiceStatus
  hasEmail:    boolean
  isAdmin:     boolean
  paidNet:     string
  ivaRate:     string
  number:      string
}

export function InvoiceActions({ id, status, hasEmail, isAdmin, paidNet, ivaRate, number }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [cascade, setCascade] = useState<string[] | null>(null)
  const [refunding, setRefunding] = useState(false)

  async function setStatus(next: InvoiceStatus) {
    setBusy(next); setError(null); setCascade(null)
    const res = await fetch(`/api/crm/invoices/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: next }),
    })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    const data = await res.json().catch(() => ({}))
    if (data.cascade?.length) setCascade(data.cascade)
    router.refresh()
  }

  async function handleSend() {
    setBusy('send'); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}/send`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не удалось отправить'); return }
    setSent(true)
    setTimeout(() => setSent(false), 3000)
    router.refresh()
  }

  async function handleCancel() {
    const msg = status === 'DRAFT'
      ? 'Удалить черновик счёта? Номер ещё не выдан, действие необратимо.'
      : (isPaid || status === 'PARTIAL') && Number(paidNet) > 0
      ? 'Отменить этот счёт? Зачтённая оплата будет полностью сторнирована (возврат виден в истории), материалы вернутся на склад, номер останется занятым.'
      : 'Отменить этот счёт? Номер останется занятым.'
    if (!confirm(msg)) return
    setBusy('cancel'); setError(null); setCascade(null)
    const res = await fetch(`/api/crm/invoices/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    if (status === 'DRAFT') { router.push('/crm/invoices'); return }
    const data = await res.json().catch(() => ({}))
    if (data.cascade?.length) setCascade(data.cascade)
    router.refresh()
  }

  async function handleIssue() {
    if (!confirm('Выпустить счёт? Будет назначен постоянный сквозной номер — после этого позиции нельзя будет редактировать напрямую.')) return
    setBusy('issue'); setError(null); setCascade(null)
    const res = await fetch(`/api/crm/invoices/${id}/issue`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    const data = await res.json().catch(() => ({}))
    if (data.cascade?.length) setCascade(data.cascade)
    router.refresh()
  }

  async function handleUnpay() {
    if (!confirm('Полностью отменить оплату? Весь зачтённый доход будет сторнирован (не удалён — останется виден в истории), счёт снова окажется в дебиторке.')) return
    setBusy('unpay'); setError(null); setCascade(null)
    const res = await fetch(`/api/crm/invoices/${id}/unpay`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    const data = await res.json().catch(() => ({}))
    if (data.cascade?.length) setCascade(data.cascade)
    router.refresh()
  }

  async function handleDuplicate() {
    setBusy('duplicate'); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}/duplicate`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    const copy = await res.json()
    router.push(`/crm/invoices/${copy.id}/edit`)
  }

  async function handlePurge() {
    if (!confirm('Удалить счёт безвозвратно? Это нельзя отменить, и номер останется дырой в сквозной нумерации — для налоговой лучше «Отменить счёт», а не удалять.')) return
    setBusy('purge'); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}/purge`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.push('/crm/invoices')
    router.refresh()
  }

  const isDraft = status === 'DRAFT'
  const isPaid  = status === 'PAID'
  const isFinal = isPaid || status === 'CANCELLED'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!isDraft && (
          <a href={`/api/crm/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">⬇ Скачать PDF</Button>
          </a>
        )}
        {isDraft && (
          <Link href={`/crm/invoices/${id}/edit`}>
            <Button variant="secondary" size="sm">✏ Редактировать</Button>
          </Link>
        )}
        {isDraft && (
          <Button size="sm" loading={busy === 'issue'} onClick={handleIssue}>
            🧾 Выпустить счёт
          </Button>
        )}
        {!isDraft && !isFinal && (
          <Button variant="secondary" size="sm" loading={busy === 'send'} disabled={!hasEmail} onClick={handleSend}>
            ✉ Отправить клиенту
          </Button>
        )}
        {!isDraft && !isFinal && (
          <Button size="sm" loading={busy === 'PAID'} onClick={() => setStatus('PAID')}>
            ✓ Отметить оплаченным
          </Button>
        )}
        {(isPaid || status === 'PARTIAL') && Number(paidNet) > 0 && (
          <Button variant="danger" size="sm" onClick={() => setRefunding(true)}>
            ↩ Оформить возврат
          </Button>
        )}
        {(isPaid || status === 'PARTIAL') && Number(paidNet) > 0 && (
          <Button variant="danger" size="sm" loading={busy === 'unpay'} onClick={handleUnpay}>
            Отменить оплату полностью
          </Button>
        )}
        <Button variant="secondary" size="sm" loading={busy === 'duplicate'} onClick={handleDuplicate}>
          ⧉ Дублировать
        </Button>
        {!isDraft && status !== 'CANCELLED' && (
          <Button variant="danger" size="sm" loading={busy === 'cancel'} onClick={handleCancel}>
            Отменить счёт
          </Button>
        )}
        {isDraft && (
          <Button variant="danger" size="sm" loading={busy === 'cancel'} onClick={handleCancel}>
            Удалить черновик
          </Button>
        )}
        {isAdmin && !isDraft && status !== 'PAID' && (
          <Button variant="danger" size="sm" loading={busy === 'purge'} onClick={handlePurge}>
            🗑 Удалить безвозвратно
          </Button>
        )}
      </div>
      {!hasEmail && !isDraft && !isFinal && (
        <p className="text-label text-gray-500">У клиента нет email — отправка недоступна.</p>
      )}
      {isDraft && (
        <p className="text-label text-gray-500">Черновик не занимает сквозной номер, пока не будет выпущен.</p>
      )}
      {sent && <p className="text-label text-success">Письмо отправлено.</p>}
      {error && <p className="text-label text-danger">{error}</p>}
      {cascade && cascade.length > 0 && (
        <div className="bg-info/10 border border-info/30 rounded-control px-3 py-2 space-y-1">
          <p className="text-label text-info font-semibold uppercase tracking-wide">Что произошло</p>
          {cascade.map((line, i) => (
            <p key={i} className="text-label text-gray-700">· {line}</p>
          ))}
        </div>
      )}
      {refunding && (
        <RefundModal
          invoiceId={id}
          invoiceNumber={number}
          paidNet={paidNet}
          ivaRate={ivaRate}
          onClose={() => setRefunding(false)}
          onDone={(lines) => { setRefunding(false); setCascade(lines); setError(null); router.refresh() }}
        />
      )}
    </div>
  )
}
