import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CRON_SECRET = process.env.CRON_SECRET

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()

  // Determine the month that just closed (previous month)
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const closedMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`

  // Find households with at least one transaction in the closed month
  const nextMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const { data: households, error: queryError } = await supabase
    .from('transactions')
    .select('household_id')
    .gte('date', closedMonth)
    .lt('date', nextMonthStart)

  if (queryError) {
    console.error('month-close: error querying transactions', queryError)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const uniqueHouseholds = Array.from(new Set((households ?? []).map(t => t.household_id)))

  let snapshotsCreated = 0
  const errors: string[] = []

  for (const householdId of uniqueHouseholds) {
    const { data, error } = await supabase.rpc('snapshot_budget_month', {
      p_household: householdId,
      p_month: closedMonth,
      p_backfilled: false,
    })

    if (error) {
      console.error(`month-close: snapshot failed for ${householdId}`, error)
      errors.push(householdId)
    } else {
      snapshotsCreated += (data as number) ?? 0
    }
  }

  console.log(`month-close: ${uniqueHouseholds.length} households, ${snapshotsCreated} snapshots created, ${errors.length} errors`)

  return NextResponse.json({
    message: 'Month close processed',
    closedMonth,
    householdsProcessed: uniqueHouseholds.length,
    snapshotsCreated,
    errors: errors.length,
  })
}
