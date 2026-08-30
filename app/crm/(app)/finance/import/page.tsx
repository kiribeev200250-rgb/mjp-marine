import { redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { ImportWizard } from '@/components/crm/finance/ImportWizard'

export default async function FinanceImportPage() {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'CREATE')

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-heading text-gray-900">Импорт из таблицы</h1>
        <p className="text-body text-gray-500 mt-1">
          Разовый перенос истории расходов, доходов, зарплат и вложений из книги (Google Sheets export) в CRM.
        </p>
      </div>
      <ImportWizard />
    </main>
  )
}
