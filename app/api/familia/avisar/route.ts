import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'
import { sendPushToUser } from '@/lib/push-send'

// "Avisarle a Ana": quien está en modo solo ver le avisa al dueño que quiere
// registrar. Un aviso por día como mucho.
export async function POST() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const plan = await getEffectivePlan(user.id)
  if (plan.isOwner || !plan.ownerId || plan.access !== 'view') {
    return NextResponse.json({ error: 'No hace falta avisar' }, { status: 400 })
  }

  const admin = adminClient()
  const key = `view-request:${user.id}:${new Date().toISOString().slice(0, 10)}`
  const { data: already } = await admin
    .from('notification_log')
    .select('id')
    .eq('user_id', plan.ownerId)
    .eq('type', 'household')
    .contains('payload', { key })
    .limit(1)
  if (already && already.length > 0) return NextResponse.json({ ok: true, sent: 0, already: true })

  const { data: me } = await admin.from('users').select('full_name, email').eq('id', user.id).single()
  const name = (me?.full_name || me?.email?.split('@')[0] || 'Tu pareja').split(' ')[0]
  const sent = await sendPushToUser(plan.ownerId, {
    title: `${name} quiere registrar en Zafi`,
    body: 'Hoy solo puede ver. Con Familiar los dos registran y reciben sus avisos.',
    url: '/planes?tier=family',
    tag: 'household-view',
    key,
  }, 'household')
  return NextResponse.json({ ok: true, sent })
}
