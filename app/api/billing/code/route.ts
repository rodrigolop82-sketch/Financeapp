import { NextResponse } from 'next/server'
import { checkCode } from '@/lib/billing/codes'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { toPublic } from '@/lib/descuentos'
import { getEffectivePlan } from '@/lib/plans'

// Revisa un código desde Planes: si existe, sigue activo y esta persona no
// lo ha usado. A qué plan aplica lo decide la pantalla con codeMismatch; el
// checkout y el canje lo vuelven a revisar.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null) as { code?: unknown } | null

  const plan = await getEffectivePlan(user.id)
  if (!plan.isOwner) return NextResponse.json({ error: 'El plan lo paga el dueño del hogar' }, { status: 403 })

  const check = await checkCode(adminClient(), user.id, body?.code)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
  return NextResponse.json({ code: toPublic(check.code) })
}
