// Lado de la base de datos de los cobros: aplica los eventos del webhook a
// subscriptions / users / household_members y resuelve los cambios de plan.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tier, Cycle } from '@/lib/plans'
import { billing } from './index'
import type { BillingEvent } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface SubscriptionRow {
  id: string
  user_id: string
  provider_subscription_id: string | null
  tier: Tier | null
  cycle: Cycle | null
  status: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  last_payment_id: string | null
  last_amount_cents: number | null
}

/** Suscripción vigente del usuario (activa o con cobro pendiente). */
export async function currentSubscription(admin: Admin, userId: string): Promise<SubscriptionRow | null> {
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .limit(1)
  return (data?.[0] as SubscriptionRow | undefined) ?? null
}

/** Acceso de los miembros del hogar del dueño (Familiar ⇒ full; si no, solo ver). */
export async function setMembersAccess(admin: Admin, ownerId: string, access: 'full' | 'view') {
  const { data: households } = await admin.from('households').select('id').eq('owner_id', ownerId)
  const ids = (households ?? []).map((h: { id: string }) => h.id)
  if (ids.length === 0) return
  await admin.from('household_members').update({ access }).in('household_id', ids).eq('role', 'member')
}

/**
 * Baja a Gratis si ya no queda ninguna suscripción vigente ni periodo pagado
 * por delante. Nunca borra nada: los miembros pasan a solo ver.
 */
export async function downgradeIfExpired(admin: Admin, userId: string, now: Date = new Date()) {
  const { data } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
  const rows = (data ?? []) as { status: string | null; current_period_end: string | null }[]
  const stillPaid = rows.some((r) =>
    r.status === 'active' || r.status === 'past_due'
    || (r.current_period_end && new Date(r.current_period_end).getTime() > now.getTime()))
  if (stillPaid) return false
  await admin.from('users').update({ plan: 'free' }).eq('id', userId)
  await setMembersAccess(admin, userId, 'view')
  return true
}

async function resolveOwner(admin: Admin, event: BillingEvent) {
  if (event.checkoutId && (!event.userId || !event.tier || !event.cycle)) {
    const { data } = await admin.from('billing_checkouts').select('user_id, tier, cycle').eq('id', event.checkoutId).maybeSingle()
    if (data) {
      event.userId ??= data.user_id
      event.tier ??= data.tier
      event.cycle ??= data.cycle
    }
  }
  if (event.providerSubscriptionId && (!event.userId || !event.tier || !event.cycle)) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id, tier, cycle')
      .eq('provider_subscription_id', event.providerSubscriptionId)
      .maybeSingle()
    if (data) {
      event.userId ??= data.user_id
      event.tier ??= data.tier
      event.cycle ??= data.cycle
    }
  }
}

/** Cambio de plan: al activarse el nuevo, cancela el viejo y reembolsa el crédito. Una sola vez. */
async function completeChangePlan(admin: Admin, event: BillingEvent) {
  if (!event.checkoutId) return
  const { data: claimed } = await admin
    .from('billing_checkouts')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', event.checkoutId)
    .is('completed_at', null)
    .select('replaces_subscription_id, credit_cents')
  const row = claimed?.[0] as { replaces_subscription_id: string | null; credit_cents: number } | undefined
  if (!row?.replaces_subscription_id || row.replaces_subscription_id === event.providerSubscriptionId) return

  const { data: old } = await admin
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', row.replaces_subscription_id)
    .maybeSingle()
  const provider = billing()
  await provider.cancel(row.replaces_subscription_id, { atPeriodEnd: false })
  if (old?.last_payment_id && row.credit_cents > 0) {
    await provider.refund(old.last_payment_id, Math.min(row.credit_cents, old.last_amount_cents ?? row.credit_cents))
  }
  await admin
    .from('subscriptions')
    .update({ status: 'cancelled', current_period_end: new Date().toISOString(), cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('provider_subscription_id', row.replaces_subscription_id)
}

export type ApplyResult = 'duplicate' | 'ignored' | 'applied' | 'unmatched'

export async function applyBillingEvent(admin: Admin, event: BillingEvent): Promise<ApplyResult> {
  // Idempotencia: el mismo evento dos veces no se procesa dos veces.
  const { error: dup } = await admin
    .from('billing_events')
    .insert({ id: event.id, type: event.rawType, payload: event.payload })
  if (dup) {
    if (dup.code === '23505') return 'duplicate'
    throw new Error(dup.message)
  }

  try {
    if (event.type === 'ignored' || event.type === 'refunded') return 'ignored'
    await resolveOwner(admin, event)
    if (!event.userId) return 'unmatched'
    const now = new Date().toISOString()

    switch (event.type) {
      case 'activated':
      case 'renewed': {
        if (event.providerSubscriptionId) {
          const row: Record<string, unknown> = {
            user_id: event.userId,
            provider_subscription_id: event.providerSubscriptionId,
            provider: 'recurrente',
            status: 'active',
            cancel_at_period_end: false,
            updated_at: now,
          }
          if (event.tier) row.tier = event.tier
          if (event.cycle) row.cycle = event.cycle
          if (event.periodStart) row.current_period_start = event.periodStart
          if (event.periodEnd) row.current_period_end = event.periodEnd
          if (event.paymentId) row.last_payment_id = event.paymentId
          if (event.amountCents) row.last_amount_cents = event.amountCents
          const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'provider_subscription_id' })
          if (error) throw new Error(error.message)
        }
        const tier = event.tier
          ?? ((await currentSubscription(admin, event.userId))?.tier as Tier | null)
          ?? 'premium'
        await admin.from('users').update({ plan: tier }).eq('id', event.userId)
        await setMembersAccess(admin, event.userId, tier === 'family' ? 'full' : 'view')
        await completeChangePlan(admin, event)
        return 'applied'
      }
      case 'payment_failed': {
        // Recurrente reintenta solo; no se quita nada hasta que cancele.
        if (event.providerSubscriptionId) {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: now })
            .eq('provider_subscription_id', event.providerSubscriptionId)
        }
        return 'applied'
      }
      case 'cancelled': {
        if (event.providerSubscriptionId) {
          await admin
            .from('subscriptions')
            .update({ status: 'cancelled', updated_at: now })
            .eq('provider_subscription_id', event.providerSubscriptionId)
        }
        // Baja a Gratis solo si ya terminó lo pagado; si no, lo hace el cron.
        await downgradeIfExpired(admin, event.userId)
        return 'applied'
      }
    }
    return 'ignored'
  } catch (e) {
    // Que el proveedor reintente: se borra la marca de idempotencia.
    await admin.from('billing_events').delete().eq('id', event.id)
    throw e
  }
}
