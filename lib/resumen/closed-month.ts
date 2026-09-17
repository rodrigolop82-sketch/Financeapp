export type ClosedCategoryStatus = 'sobregiro' | 'en_linea' | 'sin_gasto'

export interface ClosedCategoryInput {
  categoryId: string
  name: string
  budget: number
  spent: number
}

export interface ClosedCategoryResult {
  categoryId: string
  name: string
  budget: number
  spent: number
  diff: number
  pctOfBudget: number
  status: ClosedCategoryStatus
}

export interface ClosedMonthInput {
  categories: ClosedCategoryInput[]
  prevMonthsSpent: number[]
}

export interface ClosedMonthResult {
  totalBudget: number
  totalSpent: number
  diff: number
  available: number
  overrun: number
  tone: 'ok' | 'warn' | 'bad'
  headline: string
  sub: string
  categories: ClosedCategoryResult[]
  overCategories: ClosedCategoryResult[]
  okCategories: ClosedCategoryResult[]
  noSpendCategories: ClosedCategoryResult[]
  avgPrevMonths: number | null
  diffVsAvg: number | null
  diffVsAvgPct: number | null
}

function formatQ(amount: number): string {
  const rounded = Math.round(amount)
  const formatted = new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded)
  return `Q ${formatted}`
}

export function computeClosedCategory(input: ClosedCategoryInput): ClosedCategoryResult {
  const { categoryId, name, budget, spent } = input
  const diff = budget - spent
  const pctOfBudget = budget === 0 ? 0 : spent / budget

  let status: ClosedCategoryStatus
  if (spent === 0) {
    status = 'sin_gasto'
  } else if (budget === 0 || spent > budget) {
    status = 'sobregiro'
  } else {
    status = 'en_linea'
  }

  return { categoryId, name, budget, spent, diff, pctOfBudget, status }
}

export function computeClosedMonth(input: ClosedMonthInput): ClosedMonthResult {
  const categories = input.categories.map(computeClosedCategory)

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0)
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0)
  const diff = totalBudget - totalSpent
  const available = Math.max(0, diff)
  const overrun = Math.max(0, totalSpent - totalBudget)

  let tone: 'ok' | 'warn' | 'bad'
  if (diff < 0) {
    tone = 'bad'
  } else if (totalBudget > 0 && diff < totalBudget * 0.05) {
    tone = 'warn'
  } else {
    tone = 'ok'
  }

  let headline: string
  let sub: string
  if (tone === 'bad') {
    headline = `Cerraste con ${formatQ(overrun)} de sobregiro`
    sub = `Gastaste ${formatQ(totalSpent)} de un presupuesto de ${formatQ(totalBudget)}`
  } else if (tone === 'warn') {
    headline = `Cerraste ajustado, con ${formatQ(available)} de sobrante`
    sub = `Gastaste ${formatQ(totalSpent)} de ${formatQ(totalBudget)} — casi al límite`
  } else {
    headline = `Cerraste con ${formatQ(available)} de sobrante`
    sub = `Gastaste ${formatQ(totalSpent)} de un presupuesto de ${formatQ(totalBudget)}`
  }

  const overCategories = categories
    .filter(c => c.status === 'sobregiro')
    .sort((a, b) => a.diff - b.diff)
  const okCategories = categories
    .filter(c => c.status === 'en_linea')
    .sort((a, b) => b.spent - a.spent)
  const noSpendCategories = categories
    .filter(c => c.status === 'sin_gasto')

  const prev = input.prevMonthsSpent.filter(v => v > 0)
  const avgPrevMonths = prev.length > 0
    ? Math.round(prev.reduce((s, v) => s + v, 0) / prev.length)
    : null
  const diffVsAvg = avgPrevMonths !== null ? totalSpent - avgPrevMonths : null
  const diffVsAvgPct = avgPrevMonths !== null && avgPrevMonths > 0
    ? Math.round((diffVsAvg! / avgPrevMonths) * 100)
    : null

  return {
    totalBudget,
    totalSpent,
    diff,
    available,
    overrun,
    tone,
    headline,
    sub,
    categories,
    overCategories,
    okCategories,
    noSpendCategories,
    avgPrevMonths,
    diffVsAvg,
    diffVsAvgPct,
  }
}
