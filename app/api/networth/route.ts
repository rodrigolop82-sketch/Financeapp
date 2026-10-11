import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature } from '@/lib/entitlements/features'
import { getArchivedSources, getNetWorth } from '@/lib/networth/data'

export const dynamic = 'force-dynamic'

// Patrimonio neto actual (gratis). La evolución está en /api/networth/history.
export async function GET(request: Request) {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    const withArchived = new URL(request.url).searchParams.get('archivadas') === '1'
    const [data, history, archived] = await Promise.all([
      getNetWorth(ctx.admin, ctx.householdId, new Date().toISOString()),
      hasFeature(ctx.householdId, 'networth.history'),
      withArchived ? getArchivedSources(ctx.admin, ctx.householdId) : Promise.resolve([]),
    ])
    return NextResponse.json({ ...data, archived, features: { history }, canWrite: ctx.plan.access === 'full' })
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular tu patrimonio' }, { status: 500 })
  }
}
