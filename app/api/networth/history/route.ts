import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature, PREMIUM_REQUIRED } from '@/lib/entitlements/features'
import { getNetWorthHistorySeries } from '@/lib/networth/data'

export const dynamic = 'force-dynamic'

// Evolución del patrimonio (Premium). Sin la función no se devuelve la serie.
export async function GET() {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  if (!(await hasFeature(ctx.householdId, 'networth.history'))) {
    return NextResponse.json({ error: PREMIUM_REQUIRED, premium: true }, { status: 403 })
  }
  try {
    return NextResponse.json({ series: await getNetWorthHistorySeries(ctx.admin, ctx.householdId, ctx.userId, new Date().toISOString()) })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la evolución' }, { status: 500 })
  }
}
