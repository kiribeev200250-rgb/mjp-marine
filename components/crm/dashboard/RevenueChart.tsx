'use client'

interface MonthBar { month: string; income: number; expense: number }

interface Props { data: MonthBar[]; maxVal: number }

export function RevenueChart({ data, maxVal }: Props) {
  const H = 120 // px height of bars

  return (
    <div className="flex items-end gap-2 h-[160px] pt-4">
      {data.map((m) => {
        const incH  = maxVal > 0 ? Math.round((m.income  / maxVal) * H) : 0
        const expH  = maxVal > 0 ? Math.round((m.expense / maxVal) * H) : 0
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-end gap-0.5 h-[120px]">
              <div
                title={`Доход: €${m.income.toLocaleString('ru-RU')}`}
                className="w-4 bg-navy/70 rounded-t-sm"
                style={{ height: incH || 2 }}
              />
              <div
                title={`Расход: €${m.expense.toLocaleString('ru-RU')}`}
                className="w-4 bg-gray-200 rounded-t-sm"
                style={{ height: expH || 2 }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{m.month}</span>
          </div>
        )
      })}

      {/* Legend */}
      <div className="self-end ml-2 flex flex-col gap-1.5 pb-5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-navy/70" />
          <span className="text-[10px] text-gray-500">Доход</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-200" />
          <span className="text-[10px] text-gray-500">Расход</span>
        </div>
      </div>
    </div>
  )
}