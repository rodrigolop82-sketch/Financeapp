import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { parseOverride } from '@/lib/recurring/actions'

// "Ya la cancelé" / "No es una suscripción" (gratis). status null la restaura.
export async function POST(request: Request) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const parsed = parseOverride(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const { error } = await ctx.admin.from('recurring_overrides').upsert(
    { household_id: ctx.householdId, merchant_key: parsed.value.merchantKey, status: parsed.value.status, updated_at: new Date().toISOString() },
    { onConflict: 'household_id,merchant_key' },
  )
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
