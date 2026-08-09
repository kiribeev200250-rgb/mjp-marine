'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/crm/ui'
import type { InvoiceStatus } from '@prisma/client'

interface Props {
  id:          string
  status:      InvoiceStatus
  hasEmail:    boolean
}

export function InvoiceActions({ id, status, hasEmail }: Props) {
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
    if (!confirm('Отменить этот счёт? Номер останется занятым.')) return
    setBusy('cancel'); setError(null)
    const res = await fetch(`/api/crm/invoices/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.refresh()
  }

  const isFinal = status === 'PAID' || status === 'CANCELLED'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a href={`/api/crm/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm">⬇ Скачать PDF</Button>
        </a>
        {!isFinal && (
          <Button variant="secondary" size="sm" loading={busy === 'send'} disabled={!hasEmail} onClick={handleSend}>
            ✉ Отправить клиенту
          </Button>
        )}
        {!isFinal && (
          <Button variant="secondary" size="sm" loading={busy === 'PARTIAL'} onClick={() => setStatus('PARTIAL')}>
            Частично оплачен
          </Button>
        )}
        {!isFinal && (
          <Button size="sm" loading={busy === 'PAID'} onClick={() => setStatus('PAID')}>
            ✓ Отметить оплаченным
          </Button>
        )}
        {!isFinal && (
          <Button variant="danger" size="sm" loading={busy === 'cancel'} onClick={handleCancel}>
            Отменить счёт
          </Button>
        )}
      </div>
      {!hasEmail && !isFinal && (
        <p className="text-label text-gray-500">У клиента нет email — отправка недоступна.</p>
      )}
      {sent && <p className="text-label text-success">Письмо отправлено.</p>}
      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  )
}