'use client'

import { useState } from 'react'

interface Props {
  token:  string
  labels: { accept: string; reject: string; accepted: string; rejected: string; confirmReject: string }
}

export function QuotePublicActions({ token, labels }: Props) {
  const [busy, setBusy]     = useState<'accept' | 'reject' | null>(null)
  const [result, setResult] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [error, setError]   = useState<string | null>(null)

  async function act(action: 'accept' | 'reject') {
    if (action === 'reject' && !confirm(labels.confirmReject)) return
    setBusy(action); setError(null)
    const res = await fetch(`/api/crm/public/quotes/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    setBusy(null)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Error'); return }
    const data = await res.json()
    setResult(data.status)
  }

  if (result === 'ACCEPTED') {
    return <p className="text-center text-lg font-semibold" style={{ color: '#2e7d32' }}>✓ {labels.accepted}</p>
  }
  if (result === 'REJECTED') {
    return <p className="text-center text-lg font-semibold" style={{ color: '#c0392b' }}>{labels.rejected}</p>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => act('accept')}
          disabled={busy !== null}
          className="px-8 py-3 rounded-lg font-bold text-white transition disabled:opacity-50"
          style={{ background: '#0A2342' }}
        >
          {busy === 'accept' ? '…' : labels.accept}
        </button>
        <button
          onClick={() => act('reject')}
          disabled={busy !== null}
          className="px-8 py-3 rounded-lg font-bold border transition disabled:opacity-50"
          style={{ borderColor: '#c0392b', color: '#c0392b' }}
        >
          {busy === 'reject' ? '…' : labels.reject}
        </button>
      </div>
      {error && <p className="text-center text-sm mt-3" style={{ color: '#c0392b' }}>{error}</p>}
    </div>
  )
}