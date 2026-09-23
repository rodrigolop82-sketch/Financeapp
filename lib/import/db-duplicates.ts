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

/**
 * Same criteria as the original per-transaction query: an existing household
 * transaction with the exact same amount dated within ±1 day.
 */
export function flagDbDuplicates(candidates: DatedAmount[], existing: DatedAmount[]): boolean[] {
  const index = new Map<string, true>()
  for (const e of existing) index.set(`${e.date}|${cents(e.amount)}`, true)

  return candidates.map(tx => {
    const amount = cents(tx.amount)
    for (const offset of [-1, 0, 1]) {
      const day = shiftDate(tx.date, offset)
      if (day && index.has(`${day}|${amount}`)) return true
    }
    return false
  })
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
