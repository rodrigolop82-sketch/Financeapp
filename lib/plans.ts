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

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  return (data?.plan as Plan) ?? 'free'
}
