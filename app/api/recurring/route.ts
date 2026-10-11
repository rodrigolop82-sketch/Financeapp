import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature } from '@/lib/entitlements/features'
import { getRecurringCharges } from '@/lib/recurring/data'
import { localToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Cobros recurrentes detectados del hogar (calculados al momento).
export async function GET() {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    const reminders = await hasFeature(ctx.householdId, 'recurring.reminders')
    const data = await getRecurringCharges(ctx.admin, ctx.householdId, { today: localToday(), remindersEnabled: reminders })
    return NextResponse.json({ ...data, features: { reminders }, canWrite: ctx.plan.access === 'full' })
  } catch {
    return NextResponse.json({ error: 'No se pudieron calcular tus cobros recurrentes' }, { status: 500 })
  }
}
