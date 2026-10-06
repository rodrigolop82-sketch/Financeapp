import { createClient } from '@supabase/supabase-js'

export const PLAN_LIMITS = {
  FREE_AI_MESSAGES_PER_MONTH: 15,
  FREE_IMPORTS_PER_MONTH: 2,
  FREE_HISTORY_MONTHS: 3,
  FREE_VIEWERS: 1,
  FAMILY_SEATS: 2,
} as const

export type Plan = 'free' | 'premium' | 'family'
export type Tier = 'premium' | 'family'
export type Cycle = 'monthly' | 'annual'
export type Access = 'full' | 'view'

export type UsageFeature = 'ai_message' | 'statement_import'

/** Premium y Familiar quitan los límites de Gratis. */
export function isPremium(plan: Plan): boolean {
  return plan !== 'free'
}

/**
 * True mientras dura la prueba de 14 días (users.trial_ends_at). La prueba
 * es de la app, no del proveedor de pagos, y da el nivel Familiar.
 */
export function isTrialActive(trialEndsAt?: string | null, now: number = Date.now()): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt).getTime() > now
}

function asPlan(p: string | null | undefined): Plan {
  return p === 'premium' || p === 'family' ? p : 'free'
}

/** Plan propio de una fila de users, contando la prueba (prueba ⇒ Familiar). */
export function ownPlan(user: { plan: Plan | string | null; trial_ends_at?: string | null }, now: number = Date.now()): Plan {
  if (isTrialActive(user.trial_ends_at, now)) return 'family'
  return asPlan(user.plan)
}

/** Atajo para pantallas que solo distinguen Gratis de lo demás. */
export function isEffectivelyPremium(user: { plan: Plan | string | null; trial_ends_at?: string | null }): boolean {
  return ownPlan(user) !== 'free'
}

export interface EffectivePlan {
  plan: Plan
  access: Access
  isOwner: boolean
  /** Prueba del que paga el hogar (el dueño, o uno mismo sin hogar compartido). */
  trialEndsAt: string | null
  trialActive: boolean
  householdId: string | null
  /** Dueño del hogar (quien paga el plan). */
  ownerId: string | null
}

interface UserRow { plan: string | null; trial_ends_at: string | null }

/**
 * Plan efectivo = plan del dueño de su hogar (o el propio).
 * · Dueño (o sin hogar): su plan, con la prueba ⇒ Familiar.
 * · Miembro de un hogar Familiar: Familiar con el acceso guardado.
 * · Miembro de un hogar que no es Familiar: solo ver, con su propio plan
 *   para lo individual (chat, importar).
 */
export function resolveEffectivePlan(input: {
  self: UserRow
  membership: { householdId: string; ownerId: string; access: Access | string | null } | null
  owner: UserRow | null
  selfId: string
  now?: number
}): EffectivePlan {
  const now = input.now ?? Date.now()
  const m = input.membership
  const self = ownPlan(input.self, now)

  if (!m || m.ownerId === input.selfId || !input.owner) {
    return {
      plan: self,
      access: 'full',
      isOwner: true,
      trialEndsAt: input.self.trial_ends_at,
      trialActive: isTrialActive(input.self.trial_ends_at, now),
      householdId: m?.householdId ?? null,
      ownerId: m?.ownerId ?? input.selfId,
    }
  }

  const ownerPlan = ownPlan(input.owner, now)
  const family = ownerPlan === 'family'
  const stored: Access = m.access === 'view' ? 'view' : 'full'
  return {
    plan: family ? 'family' : self,
    access: family ? stored : 'view',
    isOwner: false,
    trialEndsAt: input.owner.trial_ends_at,
    trialActive: isTrialActive(input.owner.trial_ends_at, now),
    householdId: m.householdId,
    ownerId: m.ownerId,
  }
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Plan efectivo de un usuario (service role: lee también al dueño del hogar). */
export async function getEffectivePlan(userId: string): Promise<EffectivePlan> {
  const supabase = serviceClient()

  const [{ data: self }, { data: memberships }] = await Promise.all([
    supabase.from('users').select('plan, trial_ends_at').eq('id', userId).single(),
    supabase
      .from('household_members')
      .select('household_id, role, access, households(owner_id)')
      .eq('user_id', userId),
  ])

  const selfRow: UserRow = self ?? { plan: 'free', trial_ends_at: null }
  type Row = { household_id: string; role: string; access: string | null; households: { owner_id: string } | { owner_id: string }[] | null }
  const rows = (memberships ?? []) as Row[]
  const ownerOf = (r: Row) => (Array.isArray(r.households) ? r.households[0]?.owner_id : r.households?.owner_id) ?? null
  // Igual que getUserHousehold: primero el hogar al que se unió.
  const joined = rows.find((r) => r.role === 'member' && ownerOf(r))
  const owned = rows.find((r) => r.role === 'owner')
  const row = joined ?? owned

  let owner: UserRow | null = null
  const ownerId = row ? ownerOf(row) : null
  if (joined && ownerId && ownerId !== userId) {
    const { data } = await supabase.from('users').select('plan, trial_ends_at').eq('id', ownerId).single()
    owner = data ?? null
  }

  return resolveEffectivePlan({
    self: selfRow,
    selfId: userId,
    owner,
    membership: row && ownerId ? { householdId: row.household_id, ownerId, access: row.access } : null,
  })
}

/** Compatibilidad: plan efectivo como texto. */
export async function getUserPlan(userId: string): Promise<Plan> {
  return (await getEffectivePlan(userId)).plan
}

/** Precios en centavos de USD (los mismos productos de Recurrente). */
export const PRICES_CENTS: Record<Tier, Record<Cycle, number>> = {
  premium: { monthly: 499, annual: 3999 },
  family: { monthly: 699, annual: 5499 },
}

export function priceLabel(cents: number): string {
  return `$ ${(cents / 100).toFixed(2)}`
}

/** Días que dura un periodo de cobro (para prorrateos). */
export function cycleDays(cycle: Cycle): number {
  return cycle === 'annual' ? 365 : 30
}

/**
 * Crédito del plan actual al cambiar de plan: lo pagado × días restantes /
 * días del periodo. Nunca negativo ni mayor que lo pagado.
 */
export function prorationCreditCents(opts: {
  lastAmountCents: number
  periodStart: string | null
  periodEnd: string | null
  cycle: Cycle
  now?: number
}): number {
  const now = opts.now ?? Date.now()
  if (!opts.periodEnd || opts.lastAmountCents <= 0) return 0
  const end = new Date(opts.periodEnd).getTime()
  const start = opts.periodStart
    ? new Date(opts.periodStart).getTime()
    : end - cycleDays(opts.cycle) * 86_400_000
  const total = end - start
  if (total <= 0) return 0
  const left = Math.min(Math.max(end - now, 0), total)
  return Math.round(opts.lastAmountCents * (left / total))
}

/** Acceso de quien se une a un hogar: Familiar ⇒ completo; si no, solo ver. */
export function memberAccessFor(plan: Plan): Access {
  return plan === 'family' ? 'full' : 'view'
}

/** ¿Cabe una persona más? Familiar: 2 adultos; Gratis y Premium: 1 + 1 solo ver. */
export function hasSeatFor(otherMembers: number): boolean {
  return otherMembers < Math.max(PLAN_LIMITS.FAMILY_SEATS - 1, PLAN_LIMITS.FREE_VIEWERS)
}

/**
 * Primer día que Gratis deja ver: inicio del mes actual menos 2 meses
 * (FREE_HISTORY_MONTHS = 3). `today` es YYYY-MM-DD local.
 */
export function freeHistoryStart(today: string): string {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7)) - (PLAN_LIMITS.FREE_HISTORY_MONTHS - 1)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toISOString().slice(0, 10)
}

/** El `from` de una consulta con el límite de historial de Gratis. */
export function clampHistoryFrom(from: string | null | undefined, start: string): string {
  return !from || from < start ? start : from
}
