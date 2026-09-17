import { createClient } from '@supabase/supabase-js'
import { PLAN_LIMITS, getUserPlan, isPremium, type UsageFeature } from './plans'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getCurrentPeriod(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }))
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getFeatureLimit(feature: UsageFeature): number {
  switch (feature) {
    case 'ai_message':
      return PLAN_LIMITS.FREE_AI_MESSAGES_PER_MONTH
    case 'statement_import':
      return PLAN_LIMITS.FREE_IMPORTS_PER_MONTH
  }
}

function getResetDate(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }))
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toISOString()
}

export async function getUsage(
  userId: string,
  feature: UsageFeature,
): Promise<{ used: number; limit: number | null; remaining: number | null }> {
  const plan = await getUserPlan(userId)

  if (isPremium(plan)) {
    return { used: 0, limit: null, remaining: null }
  }

  const supabase = getServiceSupabase()
  const period = getCurrentPeriod()
  const limit = getFeatureLimit(feature)

  const { data } = await supabase
    .from('usage_counters')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('period', period)
    .single()

  const used = data?.count ?? 0
  return { used, limit, remaining: Math.max(0, limit - used) }
}

export async function checkAndIncrement(
  userId: string,
  feature: UsageFeature,
): Promise<{ allowed: boolean; used: number; limit: number | null; resetsAt: string }> {
  const plan = await getUserPlan(userId)
  const resetsAt = getResetDate()

  if (isPremium(plan)) {
    return { allowed: true, used: 0, limit: null, resetsAt }
  }

  const supabase = getServiceSupabase()
  const period = getCurrentPeriod()
  const limit = getFeatureLimit(feature)

  const { data, error } = await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_feature: feature,
    p_period: period,
    p_limit: limit,
  })

  if (error) {
    throw new Error(`Usage increment failed: ${error.message}`)
  }

  return {
    allowed: data.allowed,
    used: data.used,
    limit: data.limit,
    resetsAt,
  }
}

export async function rollbackIncrement(
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  const supabase = getServiceSupabase()
  const period = getCurrentPeriod()

  await supabase.rpc('decrement_usage', {
    p_user_id: userId,
    p_feature: feature,
    p_period: period,
  })
}
