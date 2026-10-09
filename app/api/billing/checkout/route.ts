import { NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { currentSubscription } from '@/lib/billing/service'
import { adminClient, appUrl, readPlanChoice, sessionUser, sandboxDetail } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'

// Abre el checkout de Recurrente. Sin prueba en el proveedor: la prueba de
// 14 días es de la app, así que siempre se cobra el primer periodo.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const choice = await readPlanChoice(request)
  if (!choice) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.isOwner) return NextResponse.json({ error: 'El plan lo paga el dueño del hogar' }, { status: 403 })

  const admin = adminClient()
  const current = await currentSubscription(admin, user.id)
  if (current) {
    return NextResponse.json({ error: 'Ya tienes un plan activo', changePlan: true }, { status: 409 })
  }

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
    await admin.from('billing_checkouts').insert({ id: checkout.id, user_id: user.id, tier: choice.tier, cycle: choice.cycle })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error('billing checkout', e)
    return NextResponse.json({ error: 'No pudimos abrir el pago', detail: sandboxDetail(e) }, { status: 502 })
  }
}
