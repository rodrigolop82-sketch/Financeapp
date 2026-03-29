import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin emails — only these users can access admin metrics
const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL || '',
]

export async function GET() {
  // 1. Check auth — must be logged in
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // 2. Check admin — must be in admin list
  if (!ADMIN_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // 3. Use service role client for aggregate queries (bypasses RLS)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 4. Gather aggregate metrics — no individual data
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    { count: totalUsers },
    { count: totalHouseholds },
    { count: totalTransactions },
    { count: transactionsToday },
    { count: transactionsWeek },
    { count: transactionsMonth },
    { count: totalDebts },
    { count: totalChatMessages },
    { count: voiceTransactions },
    { count: activeUsersWeek },
    { count: activeUsersMonth },
  ] = await Promise.all([
    adminClient.from('users').select('*', { count: 'exact', head: true }),
    adminClient.from('households').select('*', { count: 'exact', head: true }),
    adminClient.from('transactions').select('*', { count: 'exact', head: true }),
    adminClient.from('transactions').select('*', { count: 'exact', head: true }).gte('date', today),
    adminClient.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    adminClient.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    adminClient.from('debts').select('*', { count: 'exact', head: true }),
    adminClient.from('chat_messages').select('*', { count: 'exact', head: true }),
    adminClient.from('transactions').select('*', { count: 'exact', head: true }).eq('source', 'voice'),
    // Active users = users who created a transaction in the last 7 days
    adminClient.rpc('count_active_users_since', { since_date: sevenDaysAgo }),
    adminClient.rpc('count_active_users_since', { since_date: thirtyDaysAgo }),
  ])

  // Fallback for active users if RPC doesn't exist
  let activeWeek = activeUsersWeek ?? 0
  let activeMonth = activeUsersMonth ?? 0

  // If RPC fails, do a simpler query
  if (activeWeek === null || activeWeek === undefined) {
    const { data: weekData } = await adminClient
      .from('transactions')
      .select('household_id')
      .gte('created_at', sevenDaysAgo)
    activeWeek = new Set(weekData?.map(t => t.household_id)).size

    const { data: monthData } = await adminClient
      .from('transactions')
      .select('household_id')
      .gte('created_at', thirtyDaysAgo)
    activeMonth = new Set(monthData?.map(t => t.household_id)).size
  }

  // Transaction source breakdown
  const { data: sourceCounts } = await adminClient
    .from('transactions')
    .select('source')

  const sourceBreakdown: Record<string, number> = {}
  if (sourceCounts) {
    for (const t of sourceCounts) {
      const src = t.source || 'manual'
      sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1
    }
  }

  // Daily transaction counts for last 14 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()
  const { data: recentTx } = await adminClient
    .from('transactions')
    .select('date')
    .gte('created_at', fourteenDaysAgo)

  const dailyCounts: Record<string, number> = {}
  if (recentTx) {
    for (const t of recentTx) {
      const d = t.date
      dailyCounts[d] = (dailyCounts[d] || 0) + 1
    }
  }

  // User registration by day (last 30 days)
  const { data: recentUsers } = await adminClient
    .from('users')
    .select('created_at')
    .gte('created_at', thirtyDaysAgo)

  const registrationsByDay: Record<string, number> = {}
  if (recentUsers) {
    for (const u of recentUsers) {
      const d = u.created_at?.split('T')[0] || 'unknown'
      registrationsByDay[d] = (registrationsByDay[d] || 0) + 1
    }
  }

  // User list with activity summary (no financial data)
  const { data: allUsers } = await adminClient
    .from('users')
    .select('id, email, created_at, last_sign_in_at')
    .order('created_at', { ascending: false })

  // Count transactions per user (via household)
  const { data: allHouseholds } = await adminClient
    .from('households')
    .select('id, owner_id')

  const ownerToHousehold: Record<string, string> = {}
  if (allHouseholds) {
    for (const h of allHouseholds) {
      ownerToHousehold[h.owner_id] = h.id
    }
  }

  // Get transaction counts per household
  const { data: txByHousehold } = await adminClient
    .from('transactions')
    .select('household_id')

  const txCountByHousehold: Record<string, number> = {}
  if (txByHousehold) {
    for (const t of txByHousehold) {
      txCountByHousehold[t.household_id] = (txCountByHousehold[t.household_id] || 0) + 1
    }
  }

  // Get last transaction date per household
  const { data: lastTxByHousehold } = await adminClient
    .from('transactions')
    .select('household_id, created_at')
    .order('created_at', { ascending: false })

  const lastTxDateByHousehold: Record<string, string> = {}
  if (lastTxByHousehold) {
    for (const t of lastTxByHousehold) {
      if (!lastTxDateByHousehold[t.household_id]) {
        lastTxDateByHousehold[t.household_id] = t.created_at
      }
    }
  }

  const userList = (allUsers || []).map(u => {
    const hhId = ownerToHousehold[u.id] || ''
    return {
      email: u.email || 'Sin email',
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      transactionCount: hhId ? (txCountByHousehold[hhId] || 0) : 0,
      lastTransaction: hhId ? (lastTxDateByHousehold[hhId] || null) : null,
    }
  })

  return NextResponse.json({
    overview: {
      totalUsers: totalUsers ?? 0,
      totalHouseholds: totalHouseholds ?? 0,
      totalTransactions: totalTransactions ?? 0,
      totalDebts: totalDebts ?? 0,
      totalChatMessages: totalChatMessages ?? 0,
    },
    activity: {
      transactionsToday: transactionsToday ?? 0,
      transactionsWeek: transactionsWeek ?? 0,
      transactionsMonth: transactionsMonth ?? 0,
      activeHouseholdsWeek: activeWeek,
      activeHouseholdsMonth: activeMonth,
      voiceTransactions: voiceTransactions ?? 0,
    },
    sourceBreakdown,
    dailyTransactions: dailyCounts,
    registrationsByDay,
    userList,
  })
}
