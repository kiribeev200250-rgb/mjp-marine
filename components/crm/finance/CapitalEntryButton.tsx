'use client'

import { useState } from 'react'
import { CapitalEntryModal } from './CapitalEntryModal'

export function CapitalEntryButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-label text-gray-500 hover:text-gold transition">
        + Капитал
      </button>
      {open && <CapitalEntryModal onClose={() => setOpen(false)} />}
    </>
  )
}
