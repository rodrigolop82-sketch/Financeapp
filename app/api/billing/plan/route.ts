import { NextResponse } from 'next/server'
import { sessionUser } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'

// Plan efectivo del usuario (cuenta el plan del dueño del hogar y la prueba).
export async function GET() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  return NextResponse.json(await getEffectivePlan(user.id))
}
