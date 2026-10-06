import { NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { currentSubscription } from '@/lib/billing/service'
import { adminClient, appUrl, readPlanChoice, sessionUser } from '@/lib/billing/server'
import { getEffectivePlan, prorationCreditCents } from '@/lib/plans'

// Cambio de plan calculado por la app: se cobra el nuevo completo y, cuando
// el webhook confirma el pago, se cancela el viejo y se devuelve la parte no
// usada (lib/billing/service.ts › completeChangePlan).
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const choice = await readPlanChoice(request)
  if (!choice) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.isOwner) return NextResponse.json({ error: 'El plan lo paga el dueño del hogar' }, { status: 403 })

  const admin = adminClient()
  const current = await currentSubscription(admin, user.id)
  if (!current?.provider_subscription_id) return NextResponse.json({ error: 'No tienes un plan activo' }, { status: 409 })
  if (current.tier === choice.tier && current.cycle === choice.cycle) {
    return NextResponse.json({ error: 'Ya tienes este plan' }, { status: 400 })
  }

  const creditCents = prorationCreditCents({
    lastAmountCents: current.last_amount_cents ?? 0,
    periodStart: current.current_period_start,
    periodEnd: current.current_period_end,
    cycle: current.cycle ?? 'monthly',
  })

  const { data: profile } = await admin.from('users').select('full_name').eq('id', user.id).single()
  const base = appUrl(request)
  try {
    const checkout = await billing().createCheckout({
      userId: user.id,
      email: user.email!,
      name: profile?.full_name,
      tier: choice.tier,
      cycle: choice.cycle,
      successUrl: `${base}/planes?ok=1`,
      cancelUrl: `${base}/planes`,
    })
    await admin.from('billing_checkouts').insert({
      id: checkout.id,
      user_id: user.id,
      tier: choice.tier,
      cycle: choice.cycle,
      replaces_subscription_id: current.provider_subscription_id,
      credit_cents: creditCents,
    })
    return NextResponse.json({ url: checkout.url, creditCents })
  } catch (e) {
    console.error('billing change-plan', e)
    return NextResponse.json({ error: 'No pudimos abrir el pago' }, { status: 502 })
  }
}
