import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature } from '@/lib/entitlements/features'
import { getWeeklySnapshot, markViewed, weekBounds } from '@/lib/snapshot/data'
import { isMonday } from '@/lib/snapshot/weekly'
import { localToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Resumen de una semana completa (?w=YYYY-MM-DD, lunes). Sin w: la última.
// Con ?visto=1 marca como vista la semana más reciente.
export async function GET(request: Request) {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  const url = new URL(request.url)
  const today = localToday()
  try {
    const bounds = await weekBounds(ctx.admin, ctx.householdId, today)
    if (!bounds) return NextResponse.json({ empty: true })
    const w = url.searchParams.get('w')
    if (w && !isMonday(w)) return NextResponse.json({ error: 'Semana no válida' }, { status: 400 })
    // Nunca la semana en curso ni antes de la primera con datos.
    const weekStart = !w || w > bounds.latest ? bounds.latest : w < bounds.first ? bounds.first : w
    const premium = await hasFeature(ctx.householdId, 'snapshot.ai_commentary')
    const view = await getWeeklySnapshot(ctx.admin, { householdId: ctx.householdId, userId: ctx.userId, weekStart, bounds, premium })
    if (url.searchParams.get('visto') === '1' && weekStart === bounds.latest && ctx.plan.access === 'full') {
      await markViewed(ctx.admin, ctx.householdId, weekStart).catch(() => {})
    }
    return NextResponse.json({ ...view, features: { aiCommentary: premium } })
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular tu semana' }, { status: 500 })
  }
}
