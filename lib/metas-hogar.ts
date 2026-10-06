// Metas compartidas: cuánto lleva cada persona y cómo se reparte el aporte
// del mes según cómo reparten (bolsa común y mitad → 50/50; según ingresos).

import { shareOf, type SplitMode } from './cuentas-claras'
import type { Person } from './hogar'

export function contributionsBy(list: { userId: string | null; amount: number }[], fallback: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of list) {
    const who = c.userId ?? fallback
    out[who] = (out[who] ?? 0) + Number(c.amount)
  }
  return out
}

/** Redondeo a Q 10 hacia arriba (como el prototipo). */
export function roundUp10(n: number): number {
  return Math.ceil(n / 10) * 10
}

/**
 * "Q 900 al mes: Ana Q 530 · Luis Q 370". El total se redondea a Q 10 hacia
 * arriba; la parte del primero a Q 10 y el resto es del segundo.
 */
export function monthlySplit(monthly: number, mode: SplitMode, a: Person, b: Person): { total: number; parts: [number, number]; byIncome: boolean } {
  const total = roundUp10(Math.max(0, monthly))
  const income = mode === 'income' ? shareOf('income', a, b) : null
  const share = income ?? 0.5
  const first = Math.round((total * share) / 10) * 10
  return { total, parts: [first, total - first], byIncome: income !== null }
}
