import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'

// Лёгкая детекция финансовых аномалий — не статистика, а простые пороги,
// настраиваемые в Настройках (CompanyInfo.anomalyExpenseMultiplier/
// anomalyLargeAmountEur). Аудит-лог фиксирует всё, но никто не читает его
// проактивно — эта проверка запускается ежедневным cron'ом (см.
// app/api/crm/cron/reminders/route.ts) и шлёт то, что реально стоит заметить.
export async function detectFinancialAnomalies(companyId: string, since: Date): Promise<string[]> {
  const info = await prisma.companyInfo.findUnique({ where: { companyId } })
  const multiplier    = new Decimal((info?.anomalyExpenseMultiplier ?? 3).toString())
  const largeThreshold = new Decimal((info?.anomalyLargeAmountEur ?? 1000).toString())

  const findings: string[] = []
  const flaggedFinanceIds = new Set<string>()

  // 1. Расход намного больше обычного по своей категории. Сравниваем с
  // историческим средним по той же категории за последние 180 дней (не
  // считая сегодняшние записи), с минимальным полом — иначе категория с
  // историческим средним в пару евро вечно триггерит на любой мелочи.
  const todayExpenses = await prisma.financeEntry.findMany({
    where: { companyId, type: 'EXPENSE', createdAt: { gte: since }, categoryId: { not: null } },
  })
  if (todayExpenses.length > 0) {
    const since180 = new Date(); since180.setDate(since180.getDate() - 180)
    const categoryIds = [...new Set(todayExpenses.map((e) => e.categoryId!))]
    const historicalAvg = await prisma.financeEntry.groupBy({
      by: ['categoryId'],
      where: {
        companyId, type: 'EXPENSE', categoryId: { in: categoryIds },
        date: { gte: since180, lt: since },
      },
      _avg: { amount: true },
    })
    const avgMap = new Map(historicalAvg.map((h) => [h.categoryId, new Decimal((h._avg.amount ?? 0).toString())]))

    for (const e of todayExpenses) {
      const avg = avgMap.get(e.categoryId)
      if (!avg || avg.lte(5)) continue // недостаточно истории или слишком маленькая база для сравнения
      const amount = new Decimal(e.amount.toString())
      if (amount.gt(avg.times(multiplier))) {
        findings.push(`${e.autoId} — ${e.category}: ${amount.toFixed(2)} € (обычно ~${avg.toFixed(2)} €, в ${amount.div(avg).toFixed(1)}× больше)`)
        flaggedFinanceIds.add(e.id)
      }
    }
  }

  // 2. Доинвестиция без источника — нельзя проверить происхождение денег.
  const unsourcedCapital = await prisma.capitalEntry.findMany({
    where: { companyId, type: 'REINVESTMENT', createdAt: { gte: since }, source: '', amount: { gt: 0 } },
  })
  for (const c of unsourcedCapital) {
    findings.push(`${c.autoId} — доинвестиция ${new Decimal(c.amount.toString()).toFixed(2)} € без указанного источника`)
  }

  // 3. Подозрительно крупная операция (абсолютный порог, независимо от категории).
  const largeFinance = await prisma.financeEntry.findMany({
    where: { companyId, createdAt: { gte: since }, amount: { gt: largeThreshold } },
  })
  for (const e of largeFinance) {
    if (flaggedFinanceIds.has(e.id)) continue // уже отмечена по категории — не дублируем
    const amount = new Decimal(e.amount.toString())
    const label = e.type === 'INCOME' ? 'доход' : e.type === 'SALARY' ? 'зарплата' : 'расход'
    findings.push(`${e.autoId} — крупная операция (${label}): ${amount.toFixed(2)} € — ${e.category}`)
  }
  const largeCapital = await prisma.capitalEntry.findMany({
    where: { companyId, createdAt: { gte: since }, amount: { gt: largeThreshold } },
  })
  for (const c of largeCapital) {
    const amount = new Decimal(c.amount.toString())
    findings.push(`${c.autoId} — крупное вложение: ${amount.toFixed(2)} €${c.source ? ' — ' + c.source : ''}`)
  }

  return findings
}
