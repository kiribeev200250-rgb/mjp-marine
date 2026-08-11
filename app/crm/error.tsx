'use client'

import { useEffect } from 'react'

// Глобальная граница ошибок для всего /crm — вместо белого экрана/сырого
// стектрейса при неперехваченной ошибке рендера показывает понятный экран
// с возможностью попробовать снова или вернуться на дашборд. Ошибки самих
// API-запросов (fetch) обрабатываются в компонентах отдельно (см. try/catch
// в формах) — это только для ошибок рендера React.
export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[crm] Необработанная ошибка рендера:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 p-6">
      <div className="bg-white rounded-card shadow-e4 max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto text-2xl">⚠</div>
        <div>
          <h1 className="text-subheading font-bold text-gray-900">Что-то пошло не так</h1>
          <p className="text-body text-gray-500 mt-1">
            Произошла непредвиденная ошибка. Ничего не сохранилось наполовину — можно попробовать снова.
          </p>
        </div>
        {error.digest && (
          <p className="text-label text-gray-300 font-mono">Код ошибки: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="bg-gold hover:bg-gold-light text-navy font-semibold text-body px-4 py-2 rounded-control transition"
          >
            Попробовать снова
          </button>
          <a
            href="/crm/dashboard"
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-body px-4 py-2 rounded-control transition"
          >
            На дашборд
          </a>
        </div>
      </div>
    </div>
  )
}
