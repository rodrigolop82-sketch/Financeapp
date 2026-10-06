// Servidor de "Unir dos cuentas": vista previa con service role y el cobro
// del invitado (si pagaba su propio Premium, se cancela y se le devuelve lo
// que no usó).

import type { SupabaseClient } from '@supabase/supabase-js'
import { billing } from './billing'
import { currentSubscription } from './billing/service'
import { getEffectivePlan, prorationCreditCents } from './plans'
import { firstName } from './hogar'
import { localToday } from './dates'
import { findDuplicates, monthsSpan, planRows, similarGoal, type PreviewCat, type PreviewGoal, type PreviewTx } from './unir'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export async function loadInvite(admin: Admin, code: string) {
  const { data: invite } = await admin
    .from('household_invites')
    .select('id, household_id, status, expires_at')
    .eq('invite_code', code)
    .eq('status', 'active')
    .maybeSingle()
  if (!invite || new Date(invite.expires_at) < new Date()) return null
  const { data: hh } = await admin.from('households').select('*').eq('id', invite.household_id).single()
  if (!hh || hh.archived_at) return null
  return { invite, household: hh as { id: string; name: string; owner_id: string; type: string } }
}

/** Hogar activo propio del invitado (si tiene). */
export async function guestHousehold(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from('households').select('id, archived_at').eq('owner_id', userId).order('created_at')
  return ((data ?? []) as { id: string; archived_at: string | null }[]).find((h) => !h.archived_at)?.id ?? null
}

export async function mergePreview(admin: Admin, code: string, guestId: string) {
  const inv = await loadInvite(admin, code)
  if (!inv) return { error: 'invite_invalid' as const }
  const host = inv.household
  const [{ data: owner }, ownerPlan, { data: members }] = await Promise.all([
    admin.from('users').select('full_name, email').eq('id', host.owner_id).single(),
    getEffectivePlan(host.owner_id),
    admin.from('household_members').select('user_id, role').eq('household_id', host.id),
  ])
  const ownerName = firstName(owner?.full_name, owner?.email)
  const rows = (members ?? []) as { user_id: string; role: string }[]
  const isMember = rows.some((m) => m.user_id === guestId)
  const seat = !rows.some((m) => m.role === 'member')
  const { data: me } = await admin.from('users').select('full_name, email').eq('id', guestId).single()
  const guestName = firstName(me?.full_name, me?.email)
  const guestHh = await guestHousehold(admin, guestId)
  const month = localToday().slice(0, 7)
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)

  const empty = {
    host: { id: host.id, name: host.name, ownerName, family: ownerPlan.plan === 'family', seat, isOwner: host.owner_id === guestId, isMember },
    guestName,
    hasData: false,
    counts: { transactions: 0, months: '', goals: [] as string[], debts: [] as string[] },
    plan: [] as ReturnType<typeof planRows>,
    duplicates: [] as ReturnType<typeof findDuplicates>,
    goals: [] as { id: string; name: string; emoji: string | null; amount: number; similar: { id: string; name: string; amount: number } | null }[],
    debts: [] as { id: string; name: string; dueDay: number | null }[],
    refundCents: 0,
    month,
  }
  if (!guestHh) return empty

  const [{ data: gTx }, { data: gDates }, { data: hTx }, { data: hCats }, { data: gCats }, { data: gGoals }, { data: hGoals }, { data: gDebts }] = await Promise.all([
    admin.from('transactions').select('id, date, amount, description, type').eq('household_id', guestHh).gte('date', since),
    admin.from('transactions').select('date').eq('household_id', guestHh).order('date').limit(5000),
    admin.from('transactions').select('id, date, amount, description, type').eq('household_id', host.id).gte('date', since),
    admin.from('budget_categories').select('id, name, bucket, icon, budgeted_amount, parent_category_id, archived_at').eq('household_id', host.id),
    admin.from('budget_categories').select('id, name, bucket, icon, budgeted_amount, parent_category_id, archived_at').eq('household_id', guestHh),
    admin.from('financial_goals').select('*').eq('user_id', guestId),
    admin.from('financial_goals').select('*').eq('household_id', host.id).eq('user_id', host.owner_id),
    admin.from('debts').select('id, name, due_day').eq('household_id', guestHh),
  ])
  const { count: totalTx } = await admin.from('transactions').select('id', { count: 'exact', head: true }).eq('household_id', guestHh)

  const active = (c: PreviewCat & { archived_at?: string | null }) => !c.archived_at
  const goals = ((gGoals ?? []) as (PreviewGoal & { merged_into?: string | null })[]).filter((g) => !g.merged_into)
  const hostGoals = ((hGoals ?? []) as (PreviewGoal & { merged_into?: string | null })[]).filter((g) => !g.merged_into)

  // Si pagaba su propio plan: lo que se le devuelve al cancelarlo hoy.
  const sub = await currentSubscription(admin, guestId)
  const refundCents = sub ? prorationCreditCents({
    lastAmountCents: sub.last_amount_cents ?? 0,
    periodStart: sub.current_period_start,
    periodEnd: sub.current_period_end,
    cycle: sub.cycle ?? 'monthly',
  }) : 0

  const totalCount = totalTx ?? 0
  return {
    ...empty,
    hasData: totalCount > 0 || goals.length > 0 || (gDebts ?? []).length > 0,
    counts: {
      transactions: totalCount,
      months: monthsSpan(((gDates ?? []) as { date: string }[]).map((d) => d.date)),
      goals: goals.map((g) => g.name),
      debts: ((gDebts ?? []) as { name: string }[]).map((d) => d.name),
    },
    plan: planRows(((hCats ?? []) as PreviewCat[]).filter(active), ((gCats ?? []) as PreviewCat[]).filter(active)),
    duplicates: findDuplicates((hTx ?? []) as PreviewTx[], (gTx ?? []) as PreviewTx[]),
    goals: goals.map((g) => {
      const s = similarGoal(g, hostGoals)
      return { id: g.id, name: g.name, emoji: g.emoji ?? null, amount: Number(g.current_amount) || 0, similar: s ? { id: s.id, name: s.name, amount: Number(s.current_amount) || 0 } : null }
    }),
    debts: ((gDebts ?? []) as { id: string; name: string; due_day: number | null }[]).map((d) => ({ id: d.id, name: d.name, dueDay: d.due_day })),
    refundCents,
  }
}

/** Después de unir: si el invitado pagaba su plan, se cancela hoy y se reembolsa lo no usado. */
export async function settleGuestSubscription(admin: Admin, guestId: string): Promise<number> {
  const sub = await currentSubscription(admin, guestId)
  if (!sub?.provider_subscription_id) return 0
  const credit = prorationCreditCents({
    lastAmountCents: sub.last_amount_cents ?? 0,
    periodStart: sub.current_period_start,
    periodEnd: sub.current_period_end,
    cycle: sub.cycle ?? 'monthly',
  })
  const provider = billing()
  await provider.cancel(sub.provider_subscription_id, { atPeriodEnd: false })
  if (credit > 0 && sub.last_payment_id) await provider.refund(sub.last_payment_id, credit)
  await admin.from('subscriptions').update({ status: 'cancelled', current_period_end: new Date().toISOString(), cancel_at_period_end: false, updated_at: new Date().toISOString() }).eq('id', sub.id)
  await admin.from('users').update({ plan: 'free' }).eq('id', guestId)
  return credit
}
