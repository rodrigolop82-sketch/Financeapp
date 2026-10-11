import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature } from '@/lib/entitlements/features'
import { getCategoryTip } from '@/lib/challenges/tip-data'
import { localToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Tip contextual de una categoría (solo el mes en curso).
export async function GET(request: Request) {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  const categoryId = new URL(request.url).searchParams.get('categoryId')
  if (!categoryId) return NextResponse.json({ error: 'Falta la categoría' }, { status: 400 })
  try {
    const [data, multiple, activeRes] = await Promise.all([
      getCategoryTip(ctx.admin, ctx.householdId, categoryId, localToday()),
      hasFeature(ctx.householdId, 'challenges.multiple'),
      ctx.admin.from('user_challenges').select('id').eq('household_id', ctx.householdId).eq('status', 'active').limit(1),
    ])
    const blocked = !multiple && (activeRes.data ?? []).length > 0
    return NextResponse.json({ ...data, needsPremium: blocked, canWrite: ctx.plan.access === 'full' })
  } catch {
    return NextResponse.json({ tip: null, rows: [] })
  }
}

// "Ahora no": no se vuelve a mostrar este mes.
export async function POST(request: Request) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const body = (await request.json().catch(() => ({}))) as { tipKey?: unknown }
  if (typeof body.tipKey !== 'string' || !/^overspend:[0-9a-f-]{36}$/.test(body.tipKey)) {
    return NextResponse.json({ error: 'Tip no válido' }, { status: 400 })
  }
  const { error } = await ctx.admin.from('contextual_tip_dismissals').upsert(
    { household_id: ctx.householdId, tip_key: body.tipKey, period: localToday().slice(0, 7) },
    { onConflict: 'household_id,tip_key,period' },
  )
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
