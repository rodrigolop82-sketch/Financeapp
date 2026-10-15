// Funciones Premium por hogar (suscripciones, resumen semanal, retos y
// patrimonio). Una sola fuente de verdad: el plan del dueño del hogar
// (users.plan + prueba, como lib/plans.ts). El servidor decide; la UI solo
// muestra la etiqueta "Premium".

import { createClient } from '@supabase/supabase-js'
import { ownPlan, type Plan } from '../plans'

export const FEATURE_KEYS = [
  'recurring.reminders',
  'recurring.price_alerts',
  'snapshot.ai_commentary',
  'challenges.multiple',
  'challenges.customize',
  'networth.history',
  'next_step.details',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export function isFeatureKey(v: unknown): v is FeatureKey {
  return typeof v === 'string' && (FEATURE_KEYS as readonly string[]).includes(v)
}

/** Planes que incluyen cada función (hoy: todo lo que no es Gratis). */
const FEATURE_PLANS: Record<FeatureKey, readonly Plan[]> = {
  'recurring.reminders': ['premium', 'family'],
  'recurring.price_alerts': ['premium', 'family'],
  'snapshot.ai_commentary': ['premium', 'family'],
  'challenges.multiple': ['premium', 'family'],
  'challenges.customize': ['premium', 'family'],
  'networth.history': ['premium', 'family'],
  'next_step.details': ['premium', 'family'],
}

/** ¿Este plan incluye la función? (puro) */
export function planHasFeature(plan: Plan, key: FeatureKey): boolean {
  return FEATURE_PLANS[key].includes(plan)
}

/** Todas las funciones de un plan, para mandarlas a la UI. */
export function featuresForPlan(plan: Plan): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, planHasFeature(plan, k)])) as Record<FeatureKey, boolean>
}

export interface OwnerPlanRow { plan: string | null; trial_ends_at: string | null }

/** Lee el plan del dueño del hogar (service role). null si no hay hogar. */
export type OwnerPlanLoader = (householdId: string) => Promise<OwnerPlanRow | null>

const loadOwnerPlan: OwnerPlanLoader = async (householdId) => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: house } = await supabase.from('households').select('owner_id, archived_at').eq('id', householdId).maybeSingle()
  if (!house?.owner_id || house.archived_at) return null
  const { data: owner } = await supabase.from('users').select('plan, trial_ends_at').eq('id', house.owner_id).maybeSingle()
  return owner ?? null
}

/** Plan del hogar = plan propio del dueño, con la prueba ⇒ Familiar. */
export async function householdPlan(
  householdId: string,
  deps: { load?: OwnerPlanLoader; now?: number } = {},
): Promise<Plan> {
  const owner = await (deps.load ?? loadOwnerPlan)(householdId)
  if (!owner) return 'free'
  return ownPlan(owner, deps.now ?? Date.now())
}

/** Gating en servidor: ¿el hogar tiene esta función? */
export async function hasFeature(
  householdId: string,
  key: FeatureKey,
  deps: { load?: OwnerPlanLoader; now?: number } = {},
): Promise<boolean> {
  return planHasFeature(await householdPlan(householdId, deps), key)
}

/** Mensaje de rechazo cuando falta la función (403 en las rutas). */
export const PREMIUM_REQUIRED = 'Esta función es parte de Premium'
