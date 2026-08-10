'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/crm/ui'
import type { InvoiceStatus } from '@prisma/client'

interface Props {
  id:          string
  status:      InvoiceStatus
  hasEmail:    boolean
  isAdmin:     boolean
}

export function InvoiceActions({ id, status, hasEmail, isAdmin }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function setStatus(next: InvoiceStatus) {
    setBusy(next); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: next }),
    })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
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
      : 'Отменить этот счёт? Номер останется занятым.'
    if (!confirm(msg)) return
    setBusy('cancel'); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    if (status === 'DRAFT') { router.push('/crm/invoices'); return }
    router.refresh()
  }

  async function handleIssue() {
    if (!confirm('Выпустить счёт? Будет назначен постоянный сквозной номер — после этого позиции нельзя будет редактировать напрямую.')) return
    setBusy('issue'); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}/issue`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
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
  const isFinal = status === 'PAID' || status === 'CANCELLED'

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
          <Button variant="secondary" size="sm" loading={busy === 'PARTIAL'} onClick={() => setStatus('PARTIAL')}>
            Частично оплачен
          </Button>
        )}
        {!isDraft && !isFinal && (
          <Button size="sm" loading={busy === 'PAID'} onClick={() => setStatus('PAID')}>
            ✓ Отметить оплаченным
          </Button>
        )}
        <Button variant="secondary" size="sm" loading={busy === 'duplicate'} onClick={handleDuplicate}>
          ⧉ Дублировать
        </Button>
        {!isDraft && !isFinal && (
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
    </div>
  )
}
