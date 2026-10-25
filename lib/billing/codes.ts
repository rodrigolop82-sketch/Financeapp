// Códigos de descuento del lado de la base: buscar, validar para una
// persona y canjear los gratis (100%). Los parciales los cobra Recurrente
// (checkout › discount_code) y el uso se anota cuando llega el pago
// (service.ts › applyBillingEvent).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tier } from '@/lib/plans'
import {
  CODE_PATTERN, codeMismatch, codeProblem, fromRow, grantEnd, isFree, normalizeCode,
  type DiscountCode, type DiscountCodeRow,
} from '@/lib/descuentos'
import { currentSubscription, setMembersAccess } from './service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

async function redemptionCount(admin: Admin, codeId: string): Promise<number> {
  const { count } = await admin.from('discount_redemptions').select('id', { count: 'exact', head: true }).eq('code_id', codeId)
  return count ?? 0
}

export async function findCode(admin: Admin, raw: unknown): Promise<DiscountCode | null> {
  const code = normalizeCode(raw)
  if (!CODE_PATTERN.test(code)) return null
  const { data } = await admin.from('discount_codes').select('*').eq('code', code).maybeSingle()
  if (!data) return null
  const row = data as DiscountCodeRow
  return fromRow(row, await redemptionCount(admin, row.id))
}

export type CodeCheck = { ok: true; code: DiscountCode } | { ok: false; error: string }

/** ¿Puede esta persona usar el código hoy? (sin mirar el plan elegido). */
export async function checkCode(admin: Admin, userId: string, raw: unknown, now: number = Date.now()): Promise<CodeCheck> {
  const code = await findCode(admin, raw)
  if (!code) return { ok: false, error: 'Ese código no existe' }
  const { data: used } = await admin
    .from('discount_redemptions')
    .select('id')
    .eq('code_id', code.id)
    .eq('user_id', userId)
    .limit(1)
  const problem = codeProblem(code, { usedByUser: (used ?? []).length > 0, now })
  return problem ? { ok: false, error: problem } : { ok: true, code }
}

export type RedeemResult =
  | { ok: true; tier: Tier; periodEnd: string | null }
  | { ok: false; error: string; status: number }

/**
 * Canjea un código gratis: plan activo desde hoy por N meses (o sin
 * vencimiento) como una suscripción con provider = 'code'. Solo sin otro
 * plan activo. El cupo se respeta aunque dos personas canjeen a la vez: si
 * al anotar el uso se pasa del máximo, se borra y no se da.
 */
export async function redeemFreeCode(admin: Admin, opts: { userId: string; code: unknown; tier: Tier; now?: Date }): Promise<RedeemResult> {
  const now = opts.now ?? new Date()
  const check = await checkCode(admin, opts.userId, opts.code, now.getTime())
  if (!check.ok) return { ok: false, error: check.error, status: 400 }
  const code = check.code
  if (!isFree(code)) return { ok: false, error: 'Este código es un descuento: aplícalo al pagar', status: 400 }
  const mismatch = codeMismatch(code, opts.tier, 'monthly')
  if (mismatch) return { ok: false, error: mismatch, status: 400 }
  if (await currentSubscription(admin, opts.userId)) {
    return { ok: false, error: 'Ya tienes un plan activo', status: 409 }
  }

  const { data: claimed, error } = await admin
    .from('discount_redemptions')
    .insert({ code_id: code.id, user_id: opts.userId, redeemed_at: now.toISOString() })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya usaste este código', status: 400 }
    throw new Error(error.message)
  }
  const redemptionId = (claimed as { id: string }).id
  if (code.maxRedemptions != null && (await redemptionCount(admin, code.id)) > code.maxRedemptions) {
    await admin.from('discount_redemptions').delete().eq('id', redemptionId)
    return { ok: false, error: 'Este código ya se usó todas las veces posibles', status: 400 }
  }

  const periodEnd = grantEnd(code.durationMonths, now)
  const { error: subError } = await admin.from('subscriptions').insert({
    user_id: opts.userId,
    provider: 'code',
    provider_subscription_id: `code_${redemptionId}`,
    tier: opts.tier,
    cycle: null,
    status: 'active',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    discount_code_id: code.id,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })
  if (subError) {
    await admin.from('discount_redemptions').delete().eq('id', redemptionId)
    throw new Error(subError.message)
  }
  await admin.from('users').update({ plan: opts.tier }).eq('id', opts.userId)
  await setMembersAccess(admin, opts.userId, opts.tier === 'family' ? 'full' : 'view')
  return { ok: true, tier: opts.tier, periodEnd }
}

/**
 * Cron: vence los planes gratis por código cuya fecha ya pasó. Quedan como
 * 'cancelled' y el cron los baja a Gratis con downgradeIfExpired.
 */
export async function expireCodeGrants(admin: Admin, now: Date = new Date()): Promise<string[]> {
  const { data } = await admin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: now.toISOString() })
    .eq('provider', 'code')
    .eq('status', 'active')
    .lt('current_period_end', now.toISOString())
    .select('user_id')
  return Array.from(new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id)))
}
