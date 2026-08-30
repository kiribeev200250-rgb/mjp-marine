import { redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { RecurringExpensesPanel } from '@/components/crm/finance/RecurringExpensesPanel'

export default async function RecurringExpensesPage() {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-heading text-gray-900">Повторяющиеся расходы</h1>
        <p className="text-body text-gray-500 mt-1">
          Аренда, лизинг, связь и другие регулярные платежи. Каждый период система предлагает провести —
          вы подтверждаете сумму (или пропускаете), расход никогда не проводится молча.
        </p>
      </div>
      <RecurringExpensesPanel />
    </main>
  )
}
