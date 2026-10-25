import { NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { currentSubscription } from '@/lib/billing/service'
import { checkCode } from '@/lib/billing/codes'
import { codeMismatch, isFree } from '@/lib/descuentos'
import { adminClient, appUrl, readPlanChoice, sessionUser, sandboxDetail } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'

// Abre el checkout de Recurrente. Sin prueba en el proveedor: la prueba de
// 14 días es de la app, así que siempre se cobra el primer periodo.
// Con código parcial, Recurrente aplica su cupón del mismo código; los
// gratis van por /api/billing/redeem. Un plan gratis por código no impide
// pagar: el pagado lo reemplaza al activarse.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const choice = await readPlanChoice(request)
  if (!choice) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.isOwner) return NextResponse.json({ error: 'El plan lo paga el dueño del hogar' }, { status: 403 })

  const admin = adminClient()
  const current = await currentSubscription(admin, user.id)
  if (current && current.provider !== 'code') {
    return NextResponse.json({ error: 'Ya tienes un plan activo', changePlan: true }, { status: 409 })
  }

  let discount: { id: string; code: string } | null = null
  if (choice.code) {
    const check = await checkCode(admin, user.id, choice.code)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
    if (isFree(check.code)) return NextResponse.json({ error: 'Este código es gratis: no hay nada que pagar' }, { status: 400 })
    const mismatch = codeMismatch(check.code, choice.tier, choice.cycle)
    if (mismatch) return NextResponse.json({ error: mismatch }, { status: 400 })
    discount = { id: check.code.id, code: check.code.code }
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
      discountCode: discount?.code ?? null,
      successUrl: `${base}/planes?ok=1`,
      cancelUrl: `${base}/planes`,
    })
    await admin.from('billing_checkouts').insert({
      id: checkout.id, user_id: user.id, tier: choice.tier, cycle: choice.cycle, discount_code_id: discount?.id ?? null,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e) {
    console.error('billing checkout', e)
    const error = discount ? 'No pudimos abrir el pago con tu código' : 'No pudimos abrir el pago'
    return NextResponse.json({ error, detail: sandboxDetail(e) }, { status: 502 })
  }
}
