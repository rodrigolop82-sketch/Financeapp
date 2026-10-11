// Tip contextual en el detalle de una categoría en Sobregiro (gratis, por
// reglas). Solo hechos: compras, gasto y cuánto va sobre el presupuesto.
// Nunca ahorros estimados inventados. Puro, para vitest.

export interface TipInput {
  category: { id: string; name: string }
  status: 'sobregiro' | 'riesgo' | 'en_linea' | 'sin_gasto'
  purchases: number
  spent: number
  overBudget: number
  dismissed: boolean
  activeChallengeInCategory: boolean
}

export interface ContextualTip {
  tipKey: string
  categoryId: string
  categoryName: string
  purchases: number
  spent: number
  overBudget: number
}

export function tipKeyFor(categoryId: string): string {
  return `overspend:${categoryId}`
}

export function buildTip(i: TipInput): ContextualTip | null {
  if (i.status !== 'sobregiro' || i.dismissed || i.activeChallengeInCategory || i.overBudget <= 0) return null
  return {
    tipKey: tipKeyFor(i.category.id),
    categoryId: i.category.id,
    categoryName: i.category.name,
    purchases: i.purchases,
    spent: i.spent,
    overBudget: i.overBudget,
  }
}

export interface SavingsRow {
  kind: 'category' | 'subscriptions'
  label: string
  amount: number
  href: string
}

/** "Dónde puedes bajar tus gastos": hasta 3 filas con datos reales. */
export function savingsRows(
  over: { id: string; name: string; overrun: number }[],
  subscriptionsMonthly: number | null,
): SavingsRow[] {
  const rows: SavingsRow[] = over
    .filter((c) => c.overrun > 0)
    .sort((a, b) => b.overrun - a.overrun)
    .map((c) => ({ kind: 'category' as const, label: c.name, amount: Math.round(c.overrun * 100) / 100, href: `/resumen/categoria/${c.id}` }))
  const subs: SavingsRow[] = subscriptionsMonthly && subscriptionsMonthly > 0
    ? [{ kind: 'subscriptions', label: 'Suscripciones', amount: subscriptionsMonthly, href: '/resumen/suscripciones' }]
    : []
  return [...rows.slice(0, subs.length ? 2 : 3), ...subs]
}
