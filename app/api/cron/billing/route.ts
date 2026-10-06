import { NextRequest, NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { downgradeIfExpired } from '@/lib/billing/service'
import { adminClient } from '@/lib/billing/server'

const CRON_SECRET = process.env.CRON_SECRET
/** Se cancela en Recurrente si el periodo termina dentro de este margen (el cron corre 1 vez al día). */
const CANCEL_AHEAD_MS = 36 * 60 * 60 * 1000

// Diario: 1) cancela de verdad las suscripciones marcadas "al terminar el
// periodo" antes de que se renueven; 2) baja a Gratis a quien ya terminó lo
// pagado (los miembros pasan a solo ver).
export async function GET(req: NextRequest) {
  if (CRON_SECRET && req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
  const now = Date.now()

  const { data: toCancel } = await admin
    .from('subscriptions')
    .select('id, provider_subscription_id, current_period_end')
    .eq('cancel_at_period_end', true)
    .in('status', ['active', 'past_due'])
    .lt('current_period_end', new Date(now + CANCEL_AHEAD_MS).toISOString())

  let cancelled = 0
  for (const s of toCancel ?? []) {
    if (!s.provider_subscription_id) continue
    try {
      await billing().cancel(s.provider_subscription_id, { atPeriodEnd: false })
      await admin.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', s.id)
      cancelled++
    } catch (e) {
      console.error('cron billing cancel', s.id, e)
    }
  }

  const { data: ended } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'cancelled')
    .lt('current_period_end', new Date(now).toISOString())
    .gt('current_period_end', new Date(now - 7 * 86_400_000).toISOString())

  let downgraded = 0
  for (const userId of Array.from(new Set((ended ?? []).map((r) => r.user_id as string)))) {
    if (await downgradeIfExpired(admin, userId)) downgraded++
  }

  return NextResponse.json({ cancelled, downgraded })
}
