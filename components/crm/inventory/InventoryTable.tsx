'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/crm/ui'
import { MovementModal } from './MovementModal'
import type { StockMovementType } from '@prisma/client'
import Decimal from 'decimal.js'

interface Item {
  id:          string
  name:        string
  category:    string
  unit:        string
  qtyInStock:  { toString(): string }
  qtyOrdered:  { toString(): string }
  qtyMinAlert: { toString(): string }
  costPrice:   { toString(): string }
  sellPrice:   { toString(): string }
  supplier:    string
}

interface Props { items: Item[] }

function fmt(v: { toString(): string }) {
  return new Decimal(v.toString()).toFixed(2)
}

function fmtQty(v: { toString(): string }) {
  const n = new Decimal(v.toString())
  return n.isInteger() ? n.toFixed(0) : n.toFixed(2)
}

export function InventoryTable({ items }: Props) {
  const [modal, setModal] = useState<{ itemId: string; itemName: string; unit: string; type: StockMovementType } | null>(null)

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-12 text-center">
        <p className="text-gray-500 text-5xl mb-3">📦</p>
        <p className="text-gray-500 text-body">Склад пуст — добавь первый товар</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Название', 'Категория', 'В наличии', 'В заказе', 'Мин.', 'Продажная', 'Закупочная', 'Поставщик', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const qty      = new Decimal(item.qtyInStock.toString())
                const minAlert = new Decimal(item.qtyMinAlert.toString())
                const isLow    = minAlert.gt(0) && qty.lt(minAlert)
                const isOut    = qty.lte(0)

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      isOut ? 'bg-danger/5' : isLow ? 'bg-warning/5' : i % 2 === 1 ? 'bg-gray-50/30' : ''
                    } hover:bg-gray-50/70`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/crm/inventory/${item.id}`} className="text-body font-medium text-gray-900 hover:text-gold transition">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {item.category ? (
                        <Badge tone="neutral">{item.category}</Badge>
                      ) : (
                        <span className="text-gray-500 text-label">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isOut && <span className="w-2 h-2 rounded-full bg-danger shrink-0" title="Нет в наличии" />}
                        {isLow && !isOut && <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Мало" />}
                        <span className={`text-body tabular-nums font-medium ${isOut ? 'text-danger' : isLow ? 'text-warning' : 'text-gray-900'}`}>
                          {fmtQty(item.qtyInStock)} {item.unit}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body text-gray-500 tabular-nums">
                      {fmtQty(item.qtyOrdered) !== '0' ? `${fmtQty(item.qtyOrdered)} ${item.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-body text-gray-500 tabular-nums">
                      {fmtQty(item.qtyMinAlert) !== '0' ? fmtQty(item.qtyMinAlert) : '—'}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums text-gray-900">
                      {fmt(item.sellPrice) !== '0.00' ? `${fmt(item.sellPrice)} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums text-gray-500">
                      {fmt(item.costPrice) !== '0.00' ? `${fmt(item.costPrice)} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-body text-gray-500 max-w-[140px] truncate">
                      {item.supplier || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModal({ itemId: item.id, itemName: item.name, unit: item.unit, type: 'RECEIVE' })}
                          className="text-success hover:bg-success/10 text-label font-semibold px-2 py-1 rounded transition"
                          title="Приход"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setModal({ itemId: item.id, itemName: item.name, unit: item.unit, type: 'WRITE_OFF' })}
                          className="text-danger hover:bg-danger/10 text-label font-semibold px-2 py-1 rounded transition"
                          title="Списание"
                        >
                          −
                        </button>
                        <Link
                          href={`/crm/inventory/${item.id}`}
                          className="text-gray-500 hover:text-gray-900 text-label px-2 py-1 rounded transition"
                          title="Детали"
                        >
                          ···
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <MovementModal
          itemId={modal.itemId}
          itemName={modal.itemName}
          unit={modal.unit}
          defaultType={modal.type}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}