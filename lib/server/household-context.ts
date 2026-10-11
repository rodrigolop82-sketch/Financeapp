// Contexto común de las rutas por hogar: usuario de la sesión, su hogar y
// si puede escribir (modo solo ver ⇒ no). Solo servidor.

import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { getEffectivePlan, type EffectivePlan } from '@/lib/plans'

export interface HouseholdContext {
  userId: string
  householdId: string
  plan: EffectivePlan
  admin: ReturnType<typeof adminClient>
}

/** Devuelve el contexto o la respuesta de error lista para devolver. */
export async function householdContext(opts: { write?: boolean } = {}): Promise<HouseholdContext | NextResponse> {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const plan = await getEffectivePlan(user.id)
  if (!plan.householdId) return NextResponse.json({ error: 'Sin hogar' }, { status: 404 })
  if (opts.write && plan.access !== 'full') return NextResponse.json({ error: 'Estás en modo solo ver' }, { status: 403 })
  return { userId: user.id, householdId: plan.householdId, plan, admin: adminClient() }
}
