import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature } from '@/lib/entitlements/features'
import { parseReminder } from '@/lib/recurring/actions'

// Recordatorio antes del cobro: Premium (se valida aquí, no en la UI).
export async function POST(request: Request) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const body = await request.json().catch(() => null)
  const parsed = parseReminder(body, await hasFeature(ctx.householdId, 'recurring.reminders'))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const { error } = await ctx.admin.from('recurring_overrides').upsert(
    { household_id: ctx.householdId, merchant_key: parsed.value.merchantKey, remind_days_before: parsed.value.daysBefore, updated_at: new Date().toISOString() },
    { onConflict: 'household_id,merchant_key' },
  )
  if (error) return NextResponse.json({ error: 'No se pudo guardar el recordatorio' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
