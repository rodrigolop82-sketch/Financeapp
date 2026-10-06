import { NextResponse } from 'next/server'
import { currentSubscription } from '@/lib/billing/service'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { getEffectivePlan, prorationCreditCents } from '@/lib/plans'

// Estado del plan para Planes y Mi cuenta: plan efectivo, suscripción y hogar.
export async function GET() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = adminClient()
  const plan = await getEffectivePlan(user.id)
  const payerId = plan.ownerId ?? user.id
  const sub = await currentSubscription(admin, payerId)

  let household: { name: string; type: string; members: { name: string; owner: boolean; access: string }[] } | null = null
  if (plan.householdId) {
    const [{ data: hh }, { data: members }] = await Promise.all([
      admin.from('households').select('name, type').eq('id', plan.householdId).single(),
      admin.from('household_members').select('role, access, users(full_name, email)').eq('household_id', plan.householdId),
    ])
    type M = { role: string; access: string | null; users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null }
    household = {
      name: hh?.name ?? '',
      type: hh?.type ?? 'individual',
      members: ((members ?? []) as M[]).map((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users
        return {
          name: (u?.full_name || u?.email?.split('@')[0] || 'Usuario').split(' ')[0],
          owner: m.role === 'owner',
          access: m.access ?? 'full',
        }
      }).sort((a, b) => Number(b.owner) - Number(a.owner)),
    }
  }

  let ownerName: string | null = null
  if (!plan.isOwner && plan.ownerId) {
    const { data } = await admin.from('users').select('full_name, email').eq('id', plan.ownerId).single()
    ownerName = (data?.full_name || data?.email?.split('@')[0] || '').split(' ')[0] || null
  }

  return NextResponse.json({
    ...plan,
    ownerName,
    household,
    subscription: plan.isOwner && sub ? {
      tier: sub.tier,
      cycle: sub.cycle,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      creditCents: prorationCreditCents({
        lastAmountCents: sub.last_amount_cents ?? 0,
        periodStart: sub.current_period_start,
        periodEnd: sub.current_period_end,
        cycle: sub.cycle ?? 'monthly',
      }),
    } : null,
  })
}
