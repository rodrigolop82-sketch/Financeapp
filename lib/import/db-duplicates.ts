import type { SupabaseClient } from '@supabase/supabase-js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Adds `days` to a YYYY-MM-DD date. Returns null for malformed input. */
export function shiftDate(date: string, days: number): string | null {
  if (!DATE_RE.test(date)) return null
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function cents(amount: number | string): number {
  return Math.round(Number(amount) * 100)
}

type DatedAmount = { date: string; amount: number | string }

export type DbMatchKind = 'duplicate' | 'new'

export interface DbMatch {
  kind: DbMatchKind
  /** Id de la transacción existente con la que coincide (si la trae). */
  matchId: string | null
}

/**
 * Same criteria as the original per-transaction query: an existing household
 * transaction with the exact same amount dated within ±1 day. Devuelve con
 * qué transacción coincide. La clasificación completa (tolerancias, fijos y
 * emparejamiento uno a uno) está en lib/import/classify.ts.
 */
export function matchDbDuplicates(
  candidates: DatedAmount[],
  existing: (DatedAmount & { id?: string })[],
): DbMatch[] {
  const index = new Map<string, string | null>()
  for (const e of existing) {
    const k = `${e.date}|${cents(e.amount)}`
    if (!index.has(k)) index.set(k, e.id ?? null)
  }

  return candidates.map(tx => {
    const amount = cents(tx.amount)
    for (const offset of [-1, 0, 1]) {
      const day = shiftDate(tx.date, offset)
      const k = `${day}|${amount}`
      if (day && index.has(k)) return { kind: 'duplicate', matchId: index.get(k) ?? null }
    }
    return { kind: 'new', matchId: null }
  })
}

/** Envoltorio de matchDbDuplicates para lo que solo necesita sí/no. */
export function flagDbDuplicates(candidates: DatedAmount[], existing: DatedAmount[]): boolean[] {
  return matchDbDuplicates(candidates, existing).map(m => m.kind === 'duplicate')
}

const PAGE_SIZE = 1000

/** One ranged query (paginated) instead of one query per extracted transaction. */
export async function findDbDuplicates(
  supabase: SupabaseClient,
  householdId: string,
  candidates: DatedAmount[],
): Promise<boolean[]> {
  const dates = candidates.map(t => t.date).filter(d => DATE_RE.test(d)).sort()
  if (dates.length === 0) return candidates.map(() => false)

  const from = shiftDate(dates[0], -1)!
  const to = shiftDate(dates[dates.length - 1], 1)!

  const existing: DatedAmount[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('transactions')
      .select('date, amount')
      .eq('household_id', householdId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      console.warn('Duplicate lookup failed:', error.message)
      break
    }
    existing.push(...((data ?? []) as DatedAmount[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return flagDbDuplicates(candidates, existing)
}
