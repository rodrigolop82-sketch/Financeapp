import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminClient } from '@/lib/billing/server'
import { loadInvite, settleGuestSubscription } from '@/lib/unir-server'
import { firstName } from '@/lib/hogar'
import { mergeErrorText } from '@/lib/unir'
import { sendPushToUser } from '@/lib/push-send'

// Une la cuenta del invitado al hogar (merge_households, una transacción).
// Después, si pagaba su propio plan, se cancela y se reembolsa.
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { code?: string; choices?: Record<string, unknown> }
  if (!body.code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })

  const admin = adminClient()
  const inv = await loadInvite(admin, body.code)
  const { data: owner } = inv ? await admin.from('users').select('full_name, email').eq('id', inv.household.owner_id).single() : { data: null }
  const ownerName = firstName(owner?.full_name, owner?.email)

  const { data, error } = await supabase.rpc('merge_households', { p_invite_code: body.code, p_choices: body.choices ?? {} })
  if (error) {
    const code = (error.message || '').match(/[a-z_]+/)?.[0] ?? 'unknown'
    if (code === 'host_not_family' && inv) {
      const { data: me } = await admin.from('users').select('full_name, email').eq('id', user.id).single()
      await sendPushToUser(inv.household.owner_id, {
        title: `${firstName(me?.full_name, me?.email)} quiere unir su cuenta`,
        body: 'Con Premium Familiar juntan sus cuentas y cada uno registra lo suyo.',
        url: '/planes?tier=family',
        tag: 'merge-needs-family',
        key: `merge-needs-family:${user.id}:${new Date().toISOString().slice(0, 10)}`,
      }, 'household').catch(() => 0)
    }
    const status = code === 'invite_invalid' ? 404 : code === 'not_authenticated' ? 401 : 409
    return NextResponse.json({ error: mergeErrorText(code, ownerName), code }, { status })
  }

  let refundCents = 0
  try {
    refundCents = await settleGuestSubscription(admin, user.id)
  } catch (e) {
    // La unión ya quedó; el reembolso se revisa a mano si falla.
    console.error('merge: no se pudo cancelar/reembolsar el plan del invitado', e)
  }

  return NextResponse.json({ ...(data as Record<string, unknown>), refundCents })
}
