import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { CategoryManager } from '@/components/crm/finance/CategoryManager'

export default async function CategoriesPage() {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'FINANCE', 'VIEW')

  const categories = await prisma.category.findMany({
    where:   { companyId: session.user.companyId },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { entries: true } } },
  })

  const data = categories.map((c) => ({
    id: c.id, kind: c.kind, name: c.name, archived: c.archived, entriesCount: c._count.entries,
  }))

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href="/crm/finance" className="text-gray-500 hover:text-gray-900 text-body transition">← Финансы</Link>
        <span className="text-gray-500">/</span>
        <h1 className="text-heading font-bold text-gray-900">Категории</h1>
      </div>

      <div className="flex-1 p-6">
        <CategoryManager initial={data} />
      </div>
    </main>
  )
}
