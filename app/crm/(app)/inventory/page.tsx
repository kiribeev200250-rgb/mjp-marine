import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { redirect } from 'next/navigation'
import { InventoryTable } from '@/components/crm/inventory/InventoryTable'
import Decimal from 'decimal.js'

interface SearchParams { q?: string; category?: string; lowStock?: string }

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')

  const { q, category, lowStock } = sp

  const items = await prisma.inventoryItem.findMany({
    where: {
      companyId: session.user.companyId,
      active:    true,
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
      ...(category && { category }),
    },
    orderBy: { name: 'asc' },
  })

  const serialized = items.map((it) => ({
    id:          it.id,
    name:        it.name,
    category:    it.category,
    unit:        it.unit,
    qtyInStock:  it.qtyInStock.toString(),
    qtyOrdered:  it.qtyOrdered.toString(),
    qtyMinAlert: it.qtyMinAlert.toString(),
    costPrice:   it.costPrice.toString(),
    sellPrice:   it.sellPrice.toString(),
    supplier:    it.supplier,
  }))

  const filtered = lowStock === '1'
    ? serialized.filter((it) => {
        const qty = new Decimal(it.qtyInStock)
        const min = new Decimal(it.qtyMinAlert)
        return min.gt(0) && qty.lt(min)
      })
    : serialized

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[]
  const lowStockCount = serialized.filter((it) => {
    const qty = new Decimal(it.qtyInStock)
    const min = new Decimal(it.qtyMinAlert)
    return min.gt(0) && qty.lt(min)
  }).length

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading font-bold text-gray-900">Склад</h1>
            <p className="text-label text-gray-500 mt-0.5">
              {serialized.length} позиций
              {lowStockCount > 0 && (
                <span className="ml-2 text-warning font-semibold">· {lowStockCount} заканчивается</span>
              )}
            </p>
          </div>
          <Link
            href="/crm/inventory/new"
            className="inline-flex items-center gap-2 bg-navy text-white text-body font-semibold px-4 py-2 rounded-control hover:bg-navy/90 transition"
          >
            + Добавить товар
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <form className="flex items-center gap-3 flex-1" method="GET">
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Поиск по названию…"
            className="flex-1 max-w-xs rounded-control border border-gray-200 bg-gray-50 px-3 py-2 text-body text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          />
          <select
            name="category"
            defaultValue={sp.category ?? ''}
            className="rounded-control border border-gray-200 bg-gray-50 px-3 py-2 text-body text-gray-900 focus:outline-none focus:ring-2 focus:ring-info/40 focus:border-info transition"
          >
            <option value="">Все категории</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-body text-gray-500 cursor-pointer select-none">
            <input type="checkbox" name="lowStock" value="1" defaultChecked={sp.lowStock === '1'} className="accent-warning" />
            Только мало
          </label>
          <button type="submit" className="bg-navy text-white text-label font-semibold px-3 py-2 rounded-control hover:bg-navy/90 transition">
            Фильтр
          </button>
          {(sp.q || sp.category || sp.lowStock) && (
            <Link href="/crm/inventory" className="text-body text-gray-500 hover:text-gray-900 transition">
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
        <InventoryTable items={filtered} />
      </div>
    </div>
  )
}