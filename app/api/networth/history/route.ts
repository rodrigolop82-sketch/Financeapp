import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature, PREMIUM_REQUIRED } from '@/lib/entitlements/features'
import { getNetWorthHistorySeries } from '@/lib/networth/data'
import { localDate } from '@/lib/networth/compute'
import { mergeManualHistory } from '@/lib/networth/manual'
import { loadManualMonths } from '@/lib/networth/manual-server'

export const dynamic = 'force-dynamic'

// Evolución del patrimonio (Premium). Sin la función no se devuelve la serie.
// F3: los meses escritos en "Editar historial" ganan sobre los calculados.
export async function GET() {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  if (!(await hasFeature(ctx.householdId, 'networth.history'))) {
    return NextResponse.json({ error: PREMIUM_REQUIRED, premium: true }, { status: 403 })
  }
  try {
    const nowIso = new Date().toISOString()
    const [computed, manual] = await Promise.all([
      getNetWorthHistorySeries(ctx.admin, ctx.householdId, ctx.userId, nowIso),
      loadManualMonths(ctx.admin, ctx.userId),
    ])
    return NextResponse.json({ series: mergeManualHistory(computed, manual, localDate(nowIso).slice(0, 7)) })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la evolución' }, { status: 500 })
  }
}
