import { redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { SuppliersPanel } from '@/components/crm/inventory/SuppliersPanel'

export default async function SuppliersPage() {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-heading text-gray-900">Поставщики</h1>
        <p className="text-body text-gray-500 mt-1">
          Поставщики и заказы под задачу/клиента — от «заказано» до приёмки на склад и оплаты.
          Кредиторка (сколько должны поставщикам) видна в Отчётах.
        </p>
      </div>
      <SuppliersPanel />
    </main>
  )
}
