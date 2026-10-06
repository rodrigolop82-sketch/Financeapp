import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isCycle, isTier } from './catalog'
import type { Cycle, Tier } from '@/lib/plans'

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** Usuario de la sesión (o null). */
export async function sessionUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function appUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
}

export async function readPlanChoice(request: Request): Promise<{ tier: Tier; cycle: Cycle } | null> {
  const body = await request.json().catch(() => null) as { tier?: unknown; cycle?: unknown } | null
  if (!body || !isTier(body.tier) || !isCycle(body.cycle)) return null
  return { tier: body.tier, cycle: body.cycle }
}
