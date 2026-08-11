'use client'

import { useEffect } from 'react'

// Глобальная граница ошибок сайта (вне /crm — там своя, см. app/crm/error.tsx).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[site] Необработанная ошибка рендера:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto text-2xl">⚠</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Что-то пошло не так</h1>
          <p className="text-gray-500 mt-1">Произошла непредвиденная ошибка. Попробуйте обновить страницу.</p>
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="bg-orange hover:opacity-90 text-navy font-semibold px-4 py-2 rounded-lg transition"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  )
}
