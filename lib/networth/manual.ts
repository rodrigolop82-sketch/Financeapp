// Historial editable del patrimonio (F3 Etapa B). Puro, para vitest.
// El dato manual de un mes gana sobre el calculado; los meses calculados
// siguen saliendo de monthlyHistory (compute.ts), que no cambia.

import type { HistoryPoint } from './compute'

export interface ManualMonth {
  month: string // YYYY-MM
  assets: number
  liabilities: number
}

export interface HistoryRow extends HistoryPoint {
  origin: 'auto' | 'manual'
  assets?: number
  liabilities?: number
}

/** Mes más antiguo que se acepta. */
export const MIN_MONTH = '1980-01'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Une la serie calculada con los meses manuales, ordenada del más antiguo al más reciente. */
export function mergeManualHistory(computed: HistoryPoint[], manual: ManualMonth[], currentMonth: string): HistoryRow[] {
  const byMonth = new Map<string, HistoryRow>()
  for (const p of computed) byMonth.set(p.month, { ...p, origin: 'auto' })
  for (const m of manual) {
    if (m.month >= currentMonth) continue
    byMonth.set(m.month, {
      month: m.month,
      netWorth: round2(m.assets - m.liabilities),
      origin: 'manual',
      assets: m.assets,
      liabilities: m.liabilities,
    })
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
}

/** Valida un mes manual. Devuelve el mensaje para la persona, o null si está bien. */
export function validateManualMonth(input: { month?: unknown; assets?: unknown; liabilities?: unknown }, currentMonth: string): string | null {
  const { month, assets, liabilities } = input
  if (typeof month !== 'string' || !MONTH_RE.test(month) || month < MIN_MONTH) return 'Elige un mes válido.'
  if (month >= currentMonth) return 'Solo puedes editar meses que ya cerraron.'
  for (const v of [assets, liabilities]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1e12) return 'Escribe montos de cero o más.'
  }
  return null
}
