import { NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { currentSubscription } from '@/lib/billing/service'
import { adminClient, sessionUser } from '@/lib/billing/server'

// Cancela al terminar el periodo pagado ({ undo: true } lo deshace mientras
// no haya llegado la fecha). Recurrente cancela al momento, así que el cron
// diario hace la cancelación real justo antes de la renovación.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { undo?: boolean }

  const admin = adminClient()
  const current = await currentSubscription(admin, user.id)
  if (!current?.provider_subscription_id) return NextResponse.json({ error: 'No tienes un plan activo' }, { status: 409 })

  if (body.undo) {
    await admin.from('subscriptions').update({ cancel_at_period_end: false, updated_at: new Date().toISOString() }).eq('id', current.id)
    return NextResponse.json({ ok: true, cancelAtPeriodEnd: false })
  }

  try {
    const { deferred } = await billing().cancel(current.provider_subscription_id, { atPeriodEnd: true })
    await admin.from('subscriptions').update({
      cancel_at_period_end: true,
      ...(deferred ? {} : { status: 'cancelled' }),
      updated_at: new Date().toISOString(),
    }).eq('id', current.id)
    return NextResponse.json({ ok: true, cancelAtPeriodEnd: true, periodEnd: current.current_period_end })
  } catch (e) {
    console.error('billing cancel', e)
    return NextResponse.json({ error: 'No pudimos cancelar tu plan' }, { status: 502 })
  }
}
