import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { isSplitMode } from '@/lib/cuentas-claras'
import { getEffectivePlan } from '@/lib/plans'

// Cómo reparten lo compartido y el ingreso de cada uno (para "según lo que
// gana cada uno"). Lo cambia cualquiera de los dos con acceso completo.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.householdId) return NextResponse.json({ error: 'Sin hogar' }, { status: 404 })
  if (plan.access !== 'full') return NextResponse.json({ error: 'Estás en modo solo ver' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { mode?: unknown; incomes?: Record<string, unknown> }
  const admin = adminClient()

  if (body.mode !== undefined) {
    if (!isSplitMode(body.mode)) return NextResponse.json({ error: 'Modo no válido' }, { status: 400 })
    const { error } = await admin.from('households').update({ split_mode: body.mode }).eq('id', plan.householdId)
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  if (body.incomes && typeof body.incomes === 'object') {
    for (const [userId, raw] of Object.entries(body.incomes)) {
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Ingreso no válido' }, { status: 400 })
      const { error } = await admin
        .from('household_members')
        .update({ monthly_income: Math.round(n * 100) / 100 })
        .eq('household_id', plan.householdId)
        .eq('user_id', userId)
      if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
