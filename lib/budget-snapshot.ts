import { createClient } from '@/lib/supabase'
import type { BudgetSnapshot } from '@/types'

export async function getOrCreateSnapshot(
  householdId: string,
  month: string,
): Promise<BudgetSnapshot[]> {
  const supabase = createClient()

  // Try to fetch existing snapshots
  const { data: existing } = await supabase
    .from('budget_snapshots')
    .select('*')
    .eq('household_id', householdId)
    .eq('month', `${month}-01`)

  if (existing && existing.length > 0) {
    return existing as BudgetSnapshot[]
  }

  // No snapshot exists — create one on the fly (backfilled)
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, budgeted_amount, pace_mode, expected_day')
    .eq('household_id', householdId)
    .gt('budgeted_amount', 0)

  if (!categories || categories.length === 0) return []

  const rows = categories.map(c => ({
    household_id: householdId,
    category_id: c.id,
    month: `${month}-01`,
    amount: c.budgeted_amount,
    pace_mode: c.pace_mode,
    expected_day: c.expected_day,
    is_backfilled: true,
  }))

  const { data: inserted } = await supabase
    .from('budget_snapshots')
    .upsert(rows, { onConflict: 'household_id,category_id,month' })
    .select('*')

  return (inserted ?? []) as BudgetSnapshot[]
}
