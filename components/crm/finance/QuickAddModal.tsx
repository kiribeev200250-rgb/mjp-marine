'use client'

import { QuickEntryForm } from './QuickEntryForm'

interface Props {
  onClose: () => void
}

export function QuickAddModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-card shadow-e4 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-subheading font-bold text-gray-900">Записать операцию</h2>
          <button onClick={onClose} className="text-gray-200 hover:text-gray-500 text-body transition">✕</button>
        </div>
        <QuickEntryForm compact />
      </div>
    </div>
  )
}
