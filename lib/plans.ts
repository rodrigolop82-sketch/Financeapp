import { createClient } from '@supabase/supabase-js'

export const PLAN_LIMITS = {
  FREE_AI_MESSAGES_PER_MONTH: 15,
  FREE_IMPORTS_PER_MONTH: 2,
} as const

export type Plan = 'free' | 'premium'

export type UsageFeature = 'ai_message' | 'statement_import'

export function isPremium(plan: Plan): boolean {
  return plan === 'premium'
}

/**
 * True while a user's 14-day signup trial (users.trial_ends_at) hasn't
 * expired yet. This column has existed in the schema since the start
 * (DEFAULT NOW() + INTERVAL '14 days' on every new row) but nothing
 * ever read it — every new signup silently got plan='free' with no
 * trial access, despite the schema's clear intent. This is the one
 * place that now reads it.
 */
export function isTrialActive(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt).getTime() > Date.now()
}

/** The plan a user should be treated as, factoring in an active trial. */
export function isEffectivelyPremium(user: { plan: Plan | string; trial_ends_at?: string | null }): boolean {
  return user.plan === 'premium' || isTrialActive(user.trial_ends_at)
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await supabase
    .from('users')
    .select('plan, trial_ends_at')
    .eq('id', userId)
    .single()

  if (!data) return 'free'
  return isEffectivelyPremium(data) ? 'premium' : 'free'
}
