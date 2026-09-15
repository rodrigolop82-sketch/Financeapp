/**
 * One-time backfill: creates budget_snapshots for all closed months
 * that have transactions but no snapshot yet.
 *
 * Run with: npx tsx scripts/backfill-budget-snapshots.ts
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * Snapshots are marked is_backfilled = true (they use the current
 * budget, not the historical one from that month).
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  // Current month start (Guatemala UTC-6)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Find all distinct (household_id, month) pairs from transactions
  // where month < current month
  const { data: txMonths, error: txErr } = await supabase
    .from('transactions')
    .select('household_id, date')
    .lt('date', currentMonth)

  if (txErr) {
    console.error('Error fetching transactions:', txErr)
    process.exit(1)
  }

  // Build unique (household_id, month) pairs
  const pairs = new Map<string, Set<string>>()
  for (const tx of txMonths ?? []) {
    const month = (tx.date as string).slice(0, 7)
    const key = tx.household_id as string
    if (!pairs.has(key)) pairs.set(key, new Set())
    pairs.get(key)!.add(month)
  }

  // Check which pairs already have snapshots
  const { data: existingSnapshots } = await supabase
    .from('budget_snapshots')
    .select('household_id, month')

  const existingSet = new Set(
    (existingSnapshots ?? []).map(s => `${s.household_id}|${(s.month as string).slice(0, 7)}`)
  )

  let totalCreated = 0
  let householdsProcessed = 0

  for (const [householdId, months] of Array.from(pairs.entries())) {
    for (const month of Array.from(months)) {
      const key = `${householdId}|${month}`
      if (existingSet.has(key)) continue

      const { data, error } = await supabase.rpc('snapshot_budget_month', {
        p_household: householdId,
        p_month: `${month}-01`,
        p_backfilled: true,
      })

      if (error) {
        console.error(`Error for ${householdId} ${month}:`, error.message)
      } else {
        totalCreated += (data as number) ?? 0
      }
    }
    householdsProcessed++
  }

  console.log(`Backfill complete: ${householdsProcessed} households, ${totalCreated} snapshots created`)
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
