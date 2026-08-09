import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { redirect } from 'next/navigation'
import { ItemForm } from '@/components/crm/inventory/ItemForm'

export default async function NewInventoryPage() {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'CREATE')

  const rawCategories = await prisma.inventoryItem.findMany({
    where:    { companyId: session.user.companyId, active: true },
    select:   { category: true },
    distinct: ['category'],
    orderBy:  { category: 'asc' },
  })
  const categories = rawCategories.map((r) => r.category).filter(Boolean) as string[]

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-label text-gray-500 mb-1">
          <Link href="/crm/inventory" className="hover:text-gray-900 transition">Склад</Link>
          <span>/</span>
          <span className="text-gray-900">Новый товар</span>
        </div>
        <h1 className="text-heading font-bold text-gray-900">Добавить товар</h1>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-6">
          <ItemForm categories={categories} />
        </div>
      </div>
    </div>
  )
}