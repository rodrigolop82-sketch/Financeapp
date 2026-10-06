import { NextRequest, NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { downgradeIfExpired } from '@/lib/billing/service'
import { adminClient } from '@/lib/billing/server'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-send'
import { TRIAL_WARN_DAYS, trialEndText } from '@/lib/trial'

const CRON_SECRET = process.env.CRON_SECRET
/** Se cancela en Recurrente si el periodo termina dentro de este margen (el cron corre 1 vez al día). */
const CANCEL_AHEAD_MS = 36 * 60 * 60 * 1000

// Diario: 1) cancela de verdad las suscripciones marcadas "al terminar el
// periodo" antes de que se renueven; 2) baja a Gratis a quien ya terminó lo
// pagado (los miembros pasan a solo ver); 3) avisa el día 11 de la prueba.
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

  const trialWarned = await warnTrialEnding(admin, now)

  return NextResponse.json({ cancelled, downgraded, trialWarned })
}

/** Día 11: "Tu prueba termina en 3 días" por push y correo, una sola vez. */
async function warnTrialEnding(admin: ReturnType<typeof adminClient>, now: number): Promise<number> {
  const { data: users } = await admin
    .from('users')
    .select('id, email, full_name, trial_ends_at')
    .eq('plan', 'free')
    .gt('trial_ends_at', new Date(now + (TRIAL_WARN_DAYS - 1) * 86_400_000).toISOString())
    .lte('trial_ends_at', new Date(now + TRIAL_WARN_DAYS * 86_400_000).toISOString())

  let warned = 0
  for (const u of users ?? []) {
    // Los miembros de un hogar ajeno no ven avisos de pago.
    const { data: joined } = await admin.from('household_members').select('household_id').eq('user_id', u.id).eq('role', 'member').limit(1)
    if (joined && joined.length > 0) continue
    const key = `trial-end:${u.id}`
    const { data: already } = await admin.from('notification_log').select('id').eq('user_id', u.id).eq('type', 'trial').limit(1)
    if (already && already.length > 0) continue

    const when = trialEndText(u.trial_ends_at).toLowerCase()
    const sent = await sendPushToUser(u.id, {
      title: 'Tu prueba termina en 3 días',
      body: 'Mira lo que hiciste con Zafi y elige cómo seguir. No se borra nada.',
      url: '/planes/fin-prueba',
      tag: 'trial-end',
      key,
    }, 'trial')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zafiapp.com'
    const first = (u.full_name || '').split(' ')[0]
    const mail = await sendEmail({
      to: u.email,
      subject: 'Tu prueba de Zafi termina en 3 días',
      text: `Hola${first ? ` ${first}` : ''},\n\nTu prueba Premium termina ${when}. Mira lo que hiciste en estos días y elige cómo seguir: ${appUrl}/planes/fin-prueba\n\nSi sigues con Gratis no se borra nada.\n\nZafi`,
    })
    if (sent === 0 && mail.ok) {
      // Sin push: se anota igual para no repetir el correo.
      await admin.from('notification_log').insert({ user_id: u.id, type: 'trial', payload: { key, via: 'email' } })
    }
    if (sent > 0 || mail.ok) warned++
  }
  return warned
}
