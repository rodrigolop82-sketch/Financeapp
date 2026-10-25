import { NextResponse } from 'next/server'
import { isTier } from '@/lib/billing/catalog'
import { redeemFreeCode } from '@/lib/billing/codes'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'

// Canjea un código gratis (100%): activa el plan elegido desde hoy, sin
// pasar por Recurrente. Solo el dueño del hogar y sin otro plan activo.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null) as { code?: unknown; tier?: unknown } | null
  if (!body || !isTier(body.tier)) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.isOwner) return NextResponse.json({ error: 'El plan lo paga el dueño del hogar' }, { status: 403 })

  try {
    const result = await redeemFreeCode(adminClient(), { userId: user.id, code: body.code, tier: body.tier })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, tier: result.tier, periodEnd: result.periodEnd })
  } catch (e) {
    console.error('billing redeem', e)
    return NextResponse.json({ error: 'No pudimos activar tu código. Intenta de nuevo.' }, { status: 500 })
  }
}
