// Una sola definición de "suscripción" para Plan, Cómo te fue, Suscripciones
// y Movimientos. Puro (para vitest).
//
// - Suscripción: lo que está en una categoría de suscripciones del plan
//   (tope "suscripciones": streaming, gimnasio, membresías…) más los cobros
//   que se repiten cada mes dentro de esas categorías o que coinciden por
//   nombre con una suscripción del plan.
// - Pago fijo: cualquier otro cobro que se repite cada mes (luz, agua,
//   internet, colegiatura…). Tiene su propio total; no es suscripción.
//
// Total de suscripciones al mes, por categoría: lo del plan y lo cobrado no se
// suman dos veces. Una línea del plan con su cobro detectado cuenta lo mayor
// de los dos; las líneas sin cobro y los cobros sin línea de la misma
// categoría se comparan en bloque y cuenta lo mayor.

import type { PlanSubscriptions } from './plan'

export type TipoRecurrente = 'suscripcion' | 'pago_fijo'

export const TIPO_LABEL: Record<TipoRecurrente, string> = {
  suscripcion: 'Suscripción',
  pago_fijo: 'Pago fijo',
}

export interface CobroBase {
  merchantKey: string
  categoryId: string | null
  typicalAmount: number
  status: 'active' | 'possibly_cancelled'
  transactionIds?: string[]
}

export interface Recurrentes<T extends CobroBase> {
  suscripciones: {
    /** Total mensual (plan + cobros, sin contar dos veces). */
    mensual: number
    /** Líneas del plan + cobros activos de suscripción fuera del plan. */
    cantidad: number
    /** Cobros activos de suscripción que no están en una línea del plan. */
    fueraDelPlan: T[]
  }
  pagosFijos: {
    mensual: number
    cantidad: number
    cobros: T[]
  }
  /** Tipo de cada cobro detectado (por merchantKey). */
  tipos: Record<string, TipoRecurrente>
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

export function clasificarRecurrentes<T extends CobroBase>(
  plan: PlanSubscriptions,
  charges: T[],
  subscriptionCategoryIds: Iterable<string>,
): Recurrentes<T> {
  const subCats = new Set(subscriptionCategoryIds)
  const byKey = new Map(charges.map((c) => [c.merchantKey, c]))
  const inPlan = new Set(plan.lines.map((l) => l.merchantKey).filter((k): k is string => !!k))

  const tipos: Record<string, TipoRecurrente> = {}
  for (const c of charges) {
    tipos[c.merchantKey] = inPlan.has(c.merchantKey) || (c.categoryId !== null && subCats.has(c.categoryId)) ? 'suscripcion' : 'pago_fijo'
  }
  const active = charges.filter((c) => c.status === 'active')
  const fueraDelPlan = active.filter((c) => tipos[c.merchantKey] === 'suscripcion' && !inPlan.has(c.merchantKey))
  const fijos = active.filter((c) => tipos[c.merchantKey] === 'pago_fijo')

  // Por categoría: líneas con cobro (lo mayor), y en bloque líneas sin cobro vs. cobros sin línea.
  const cats = new Set<string>([...plan.lines.map((l) => l.categoryId), ...fueraDelPlan.map((c) => c.categoryId ?? '')])
  let mensual = 0
  for (const cat of Array.from(cats)) {
    const lines = plan.lines.filter((l) => l.categoryId === cat)
    for (const l of lines.filter((x) => x.merchantKey)) {
      const c = byKey.get(l.merchantKey!)
      mensual += Math.max(l.monthly, c && c.status === 'active' ? c.typicalAmount : 0)
    }
    const sinCobro = lines.filter((x) => !x.merchantKey).reduce((s, l) => s + l.monthly, 0)
    const sinLinea = fueraDelPlan.filter((c) => (c.categoryId ?? '') === cat).reduce((s, c) => s + c.typicalAmount, 0)
    mensual += Math.max(sinCobro, sinLinea)
  }

  return {
    suscripciones: { mensual: r2(mensual), cantidad: plan.lines.length + fueraDelPlan.length, fueraDelPlan },
    pagosFijos: { mensual: r2(fijos.reduce((s, c) => s + c.typicalAmount, 0)), cantidad: fijos.length, cobros: fijos },
    tipos,
  }
}

/**
 * Etiqueta de un movimiento en Movimientos: el tipo del cobro recurrente al
 * que pertenece; si no es de ninguno, "Suscripción" si su categoría es de
 * suscripciones. null si no es recurrente.
 */
export function tipoDeMovimiento(
  tx: { id: string; category_id: string | null; type: 'expense' | 'income' },
  porMovimiento: Record<string, TipoRecurrente>,
  subscriptionCategoryIds: ReadonlySet<string>,
): TipoRecurrente | null {
  if (tx.type !== 'expense') return null
  if (porMovimiento[tx.id]) return porMovimiento[tx.id]
  if (tx.category_id && subscriptionCategoryIds.has(tx.category_id)) return 'suscripcion'
  return null
}

/** Tipo de cada movimiento de los cobros detectados (id → tipo). */
export function tiposPorMovimiento(charges: CobroBase[], tipos: Record<string, TipoRecurrente>): Record<string, TipoRecurrente> {
  const out: Record<string, TipoRecurrente> = {}
  for (const c of charges) for (const id of c.transactionIds ?? []) out[id] = tipos[c.merchantKey]
  return out
}
