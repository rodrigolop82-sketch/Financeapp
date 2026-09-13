export type PaceMode = 'linear' | 'fixed'

export interface CategoryBudgetInput {
  categoryId: string
  name: string
  budget: number
  spent: number
  paceMode: PaceMode
  expectedDay: number | null
}

export interface MonthContext {
  today: Date
  daysInMonth: number
  dayOfMonth: number
}

export type BudgetStatus = 'sobregiro' | 'riesgo' | 'en_linea' | 'sin_gasto'

export interface CategoryPace {
  categoryId: string
  name: string
  budget: number
  spent: number
  expected: number
  overrun: number
  remaining: number
  pctOfBudget: number
  pctOfMonthElapsed: number
  projection: number
  status: BudgetStatus
}

export function computeCategoryPace(
  input: CategoryBudgetInput,
  ctx: MonthContext,
): CategoryPace {
  const { categoryId, name, budget, spent, paceMode, expectedDay } = input
  const pctOfMonthElapsed = ctx.dayOfMonth / ctx.daysInMonth
  const effectiveDay = expectedDay ?? 1

  let expected: number
  let projection: number

  if (paceMode === 'fixed') {
    expected = ctx.dayOfMonth >= effectiveDay ? budget : 0
    projection = ctx.dayOfMonth < effectiveDay ? Math.max(spent, budget) : spent
  } else {
    expected = budget * pctOfMonthElapsed
    projection = spent === 0 ? 0 : spent / pctOfMonthElapsed
  }

  const overrun = Math.max(0, spent - budget)
  const remaining = Math.max(0, budget - spent)
  const pctOfBudget = budget === 0 ? 0 : spent / budget

  let status: BudgetStatus
  if (spent === 0) {
    status = 'sin_gasto'
  } else if (budget === 0) {
    status = 'sobregiro'
  } else if (spent > budget) {
    status = 'sobregiro'
  } else if (paceMode === 'linear' && projection > budget * 1.05) {
    status = 'riesgo'
  } else {
    status = 'en_linea'
  }

  return {
    categoryId,
    name,
    budget,
    spent,
    expected,
    overrun: budget === 0 && spent > 0 ? spent : overrun,
    remaining,
    pctOfBudget,
    pctOfMonthElapsed,
    projection,
    status,
  }
}

function formatQ(amount: number): string {
  const rounded = Math.round(amount)
  const formatted = new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded)
  return `Q ${formatted}`
}

function plural(n: number, word: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`
}

export interface MonthSummary {
  totalBudget: number
  totalSpent: number
  totalExpected: number
  totalOverrun: number
  available: number
  overCategories: CategoryPace[]
  riskCategories: CategoryPace[]
  okCategories: CategoryPace[]
  verdict: { headline: string; sub: string; tone: 'ok' | 'warn' | 'danger' }
}

export function summarizeMonth(
  items: CategoryPace[],
  ctx: MonthContext,
): MonthSummary {
  const totalBudget = items.reduce((s, i) => s + i.budget, 0)
  const totalSpent = items.reduce((s, i) => s + i.spent, 0)
  const totalExpected = items.reduce((s, i) => s + i.expected, 0)
  const totalOverrun = items
    .filter((i) => i.status === 'sobregiro')
    .reduce((s, i) => s + i.overrun, 0)
  const available = Math.max(0, totalBudget - totalSpent)

  const overCategories = items
    .filter((i) => i.status === 'sobregiro')
    .sort((a, b) => b.overrun - a.overrun)
  const riskCategories = items.filter((i) => i.status === 'riesgo')
  const okCategories = items
    .filter((i) => i.status === 'en_linea' && i.spent > 0)
    .sort((a, b) => b.spent - a.spent)

  const d = ctx.dayOfMonth
  const D = ctx.daysInMonth

  let verdict: MonthSummary['verdict']

  if (overCategories.length > 0) {
    const n = overCategories.length
    const sub =
      riskCategories.length > 0
        ? `Día ${d} de ${D} · ${plural(riskCategories.length, 'categoría')} más en riesgo`
        : `Día ${d} de ${D} · el resto del presupuesto va en línea`
    verdict = {
      headline: `Vas ${formatQ(totalOverrun)} arriba del presupuesto en ${plural(n, 'categoría')}`,
      sub,
      tone: 'danger',
    }
  } else if (riskCategories.length > 0) {
    const n = riskCategories.length
    const nombres = riskCategories.map((c) => c.name).join(', ')
    verdict = {
      headline: `Vas en línea, pero ${plural(n, 'categoría')} van rápido`,
      sub: `Día ${d} de ${D} · a este ritmo superarías el presupuesto en ${nombres}`,
      tone: 'warn',
    }
  } else {
    verdict = {
      headline: 'Vas en línea con tu presupuesto',
      sub: `Día ${d} de ${D} · ${formatQ(available)} disponibles`,
      tone: 'ok',
    }
  }

  return {
    totalBudget,
    totalSpent,
    totalExpected,
    totalOverrun,
    available,
    overCategories,
    riskCategories,
    okCategories,
    verdict,
  }
}
