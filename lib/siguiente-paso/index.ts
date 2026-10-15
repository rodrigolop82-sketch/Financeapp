// "Tu siguiente mejor paso" (F1). Módulo de solo lectura: no guarda nada y
// no cambia el cálculo del puntaje. Para estimar cuánto sube cada paso llama
// a calculateScore (lib/score-calculator.ts, sin editarlo) con una copia de
// las entradas modificada. Puro, para vitest.
//
// Pasos posibles (Estabilidad de ingreso no genera pasos: no se cambia de un
// mes a otro):
// - emergency: aportar al fondo de emergencia (cuenta también como ahorro).
// - savings: apartar más para tus metas.
// - debt: pagar extra a la deuda de mayor interés hasta terminarla (su cuota
//   deja de pesar).
// - spending: mantener en su tope la categoría que más se pasó.

import { calculateScore, type ScoreInput, type ScoreKey } from '../score-calculator'
import { categoryPlan, type PlanCategory, type PlanSubItem } from '../plan-del-mes'

export type PasoKey = 'emergency' | 'savings' | 'debt' | 'spending'

export interface DeudaPaso {
  id: string
  name: string
  balance: number | string
  interest_rate: number | string | null
  min_payment: number | string | null
}

export interface CategoriaPasada {
  id: string
  name: string
  excess: number
}

export interface PasosContexto {
  debts: DeudaPaso[]
  overCategories: CategoriaPasada[]
}

export interface Paso {
  key: PasoKey
  /** Componente del puntaje que mueve. */
  component: ScoreKey
  /** Monto del paso (aporte, saldo de la deuda o exceso de la categoría). */
  amount: number
  /** Deuda o categoría del paso. */
  name?: string
  targetId?: string
  /** Puntaje hoy y estimado con el paso. */
  from: number
  to: number
  gain: number
  /** Partes del puntaje que cambian, antes y después (detalle Premium). */
  cambios: CambioParte[]
  href: string
}

export interface CambioParte {
  key: ScoreKey
  label: string
  from: number
  to: number
}

export const MAX_PASOS = 3
/** Un paso que sube menos de esto no se muestra. */
export const MIN_GAIN = 1

/** Redondea hacia arriba a múltiplos de 50 (montos fáciles de leer). */
export function round50(n: number): number {
  return n <= 0 ? 0 : Math.ceil(n / 50) * 50
}

/** Entradas del puntaje con el paso aplicado (para estimar y para simular). */
export function aplicarPaso(input: ScoreInput, key: PasoKey, amount: number, extra?: { minPayment?: number }): ScoreInput {
  const a = Math.max(0, amount)
  switch (key) {
    case 'emergency':
      return { ...input, emergencyFund: input.emergencyFund + a, saved: input.saved + a }
    case 'savings':
      return { ...input, saved: input.saved + a }
    case 'debt':
      return { ...input, debtPayments: Math.max(0, input.debtPayments - (extra?.minPayment ?? 0)) }
    case 'spending':
      return { ...input, spent: Math.max(0, input.spent - a) }
  }
}

function cambiosEntre(antes: ScoreInput, despues: ScoreInput): CambioParte[] {
  const after = new Map(calculateScore(despues).components.map((c) => [c.key, c.score]))
  return calculateScore(antes).components
    .map((c) => ({ key: c.key, label: c.label, from: c.score, to: after.get(c.key) ?? c.score }))
    .filter((c) => c.to !== c.from)
}

interface Candidato {
  key: PasoKey
  component: ScoreKey
  amount: number
  name?: string
  targetId?: string
  next: ScoreInput
  effort: number
  href: string
}

function candidatos(input: ScoreInput, ctx: PasosContexto): Candidato[] {
  const out: Candidato[] = []
  const income = input.income
  const monthly = round50(income * 0.1)

  // Fondo de emergencia: hasta 3 meses de gastos fijos, luego hasta 6.
  if (input.fixedExpenses > 0) {
    const months = input.emergencyFund / input.fixedExpenses
    const target = months < 3 ? 3 : 6
    const gap = target * input.fixedExpenses - input.emergencyFund
    const amount = Math.min(round50(gap), monthly)
    if (gap > 0 && amount > 0) {
      out.push({
        key: 'emergency', component: 'emergency', amount,
        next: aplicarPaso(input, 'emergency', amount),
        effort: amount / income,
        href: input.emergencyGoalId ? `/metas/${input.emergencyGoalId}?from=siguiente-paso` : '/plan?s=metas',
      })
    }
  }

  // Ahorro: hasta guardar 20% del ingreso.
  const savingsGap = income * 0.2 - Math.max(0, input.saved)
  const savingsAmount = Math.min(round50(savingsGap), monthly)
  if (savingsGap > 0 && savingsAmount > 0) {
    out.push({
      key: 'savings', component: 'savings', amount: savingsAmount,
      next: aplicarPaso(input, 'savings', savingsAmount),
      effort: savingsAmount / income,
      href: '/plan?s=metas',
    })
  }

  // Deuda: la de mayor interés, hasta terminarla.
  const debt = ctx.debts
    .map((d) => ({ ...d, bal: Number(d.balance) || 0, rate: Number(d.interest_rate) || 0, min: Number(d.min_payment) || 0 }))
    .filter((d) => d.bal > 0 && d.min > 0)
    .sort((a, b) => b.rate - a.rate || b.min - a.min)[0]
  if (debt) {
    out.push({
      key: 'debt', component: 'debt', amount: debt.bal, name: debt.name, targetId: debt.id,
      next: aplicarPaso(input, 'debt', debt.bal, { minPayment: debt.min }),
      effort: debt.bal / income,
      href: '/plan/deudas/plan-de-pago',
    })
  }

  // Gasto: la categoría que más se pasó de su tope.
  const over = [...ctx.overCategories].filter((c) => c.excess > 0).sort((a, b) => b.excess - a.excess)[0]
  if (over) {
    out.push({
      key: 'spending', component: 'spending', amount: over.excess, name: over.name, targetId: over.id,
      next: aplicarPaso(input, 'spending', over.excess),
      effort: over.excess / income,
      href: '/plan',
    })
  }
  return out
}

/**
 * Hasta tres pasos, ordenados por puntos ganados contra esfuerzo (monto
 * sobre el ingreso). Nunca inventa un paso: si ninguno suma puntos, [].
 */
export function siguientesPasos(input: ScoreInput, ctx: PasosContexto): Paso[] {
  const base = calculateScore(input)
  if (base.components.length === 0 || !(input.income > 0)) return []
  return candidatos(input, ctx)
    .map((c) => {
      const to = calculateScore(c.next).total
      return {
        paso: {
          key: c.key, component: c.component, amount: c.amount, name: c.name, targetId: c.targetId,
          from: base.total, to, gain: to - base.total,
          cambios: cambiosEntre(input, c.next),
          href: c.href,
        } satisfies Paso,
        ratio: (to - base.total) / Math.max(0.02, c.effort),
      }
    })
    .filter((x) => x.paso.gain >= MIN_GAIN)
    .sort((a, b) => b.ratio - a.ratio || b.paso.gain - a.paso.gain)
    .slice(0, MAX_PASOS)
    .map((x) => x.paso)
}

/** Categorías de básico y gustos que este mes se pasaron de su plan. */
export function categoriasPasadas(
  categories: (PlanCategory & { name?: string; archived_at?: string | null })[],
  subItems: PlanSubItem[],
  txs: { amount: number | string; type: 'expense' | 'income'; category_id: string | null; date: string }[],
  month: string,
): CategoriaPasada[] {
  const spent = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'expense' || !t.category_id || !t.date.startsWith(month)) continue
    spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + (Number(t.amount) || 0))
  }
  return categories
    .filter((c) => !c.archived_at && (c.bucket === 'needs' || c.bucket === 'wants'))
    .map((c) => {
      const plan = categoryPlan(c, subItems)
      const excess = Math.round(((spent.get(c.id) ?? 0) - plan) * 100) / 100
      return { id: c.id, name: c.name ?? '', excess: plan > 0 ? excess : 0 }
    })
    .filter((c) => c.excess > 0)
    .sort((a, b) => b.excess - a.excess)
}
