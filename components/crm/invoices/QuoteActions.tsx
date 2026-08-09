'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/crm/ui'
import type { QuoteStatus } from '@prisma/client'

interface Props {
  id:       string
  status:   QuoteStatus
  hasEmail: boolean
}

export function QuoteActions({ id, status, hasEmail }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function setStatus(next: QuoteStatus) {
    setBusy(next); setError(null)
    const res = await fetch(`/api/crm/quotes/${id}`, {
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
    const res = await fetch(`/api/crm/quotes/${id}/send`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не удалось отправить'); return }
    setSent(true)
    setTimeout(() => setSent(false), 3000)
    router.refresh()
  }

  async function handleConvert() {
    setBusy('convert'); setError(null)
    const res = await fetch(`/api/crm/quotes/${id}/convert`, { method: 'POST' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    const invoice = await res.json()
    router.push(`/crm/invoices/${invoice.id}`)
  }

  async function handleDelete() {
    if (!confirm('Удалить черновик пресмета?')) return
    setBusy('delete'); setError(null)
    const res = await fetch(`/api/crm/quotes/${id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Ошибка'); return }
    router.push('/crm/invoices?tab=quotes')
  }

  const isFinal = status === 'ACCEPTED' || status === 'REJECTED'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a href={`/api/crm/quotes/${id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm">⬇ Скачать PDF</Button>
        </a>
        {status === 'DRAFT' && (
          <Button variant="secondary" size="sm" loading={busy === 'send'} disabled={!hasEmail} onClick={handleSend}>
            ✉ Отправить клиенту
          </Button>
        )}
        {status === 'SENT' && (
          <>
            <Button size="sm" loading={busy === 'ACCEPTED'} onClick={() => setStatus('ACCEPTED')}>
              ✓ Принят
            </Button>
            <Button variant="danger" size="sm" loading={busy === 'REJECTED'} onClick={() => setStatus('REJECTED')}>
              Отклонён
            </Button>
          </>
        )}
        {status === 'ACCEPTED' && (
          <Button size="sm" loading={busy === 'convert'} onClick={handleConvert}>
            🧾 Создать счёт из пресмета
          </Button>
        )}
        {status === 'DRAFT' && (
          <Button variant="danger" size="sm" loading={busy === 'delete'} onClick={handleDelete}>
            Удалить
          </Button>
        )}
      </div>
      {!hasEmail && status === 'DRAFT' && (
        <p className="text-label text-gray-500">У клиента нет email — отправка недоступна.</p>
      )}
      {sent && <p className="text-label text-success">Письмо отправлено.</p>}
      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  )
}