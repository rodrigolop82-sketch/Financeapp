import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { billing } from '@/lib/billing'
import { confirmacionValida, suscripcionesPorCancelar } from '@/lib/eliminar-cuenta'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const FEEDBACK_BUCKET = 'feedback'

// Elimina la cuenta de quien tiene la sesión (C5). Orden:
// 1. Confirmación escrita ("ELIMINAR").
// 2. Cancela de inmediato su suscripción en Recurrente; si falla, no borra nada.
// 3. Borra las capturas de sus ideas enviadas del almacenamiento.
// 4. eliminar_cuenta (SQL, una transacción): hogar propio borrado o pasado
//    a la otra persona, lo personal borrado, facturación anónima, usuario y
//    acceso borrados.
// 5. Cierra la sesión.
export async function POST(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { confirmacion?: unknown }
  if (!confirmacionValida(body.confirmacion)) {
    return NextResponse.json({ error: 'Escribe ELIMINAR para confirmar' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: subs, error: subsError } = await admin
    .from('subscriptions').select('provider_subscription_id, status').eq('user_id', user.id)
  if (subsError) return NextResponse.json({ error: 'No pudimos revisar tu plan. Intenta de nuevo.' }, { status: 500 })
  try {
    for (const id of suscripcionesPorCancelar(subs ?? [])) {
      await billing().cancel(id, { atPeriodEnd: false })
    }
  } catch (e) {
    console.error('eliminar cuenta: cancelar plan', e)
    return NextResponse.json({ error: 'No pudimos cancelar tu plan, así que no borramos nada. Intenta de nuevo.' }, { status: 502 })
  }

  const { data: shots } = await admin
    .from('feedback').select('screenshot_path').eq('user_id', user.id).not('screenshot_path', 'is', null)
  const paths = ((shots ?? []) as { screenshot_path: string }[]).map((s) => s.screenshot_path)
  if (paths.length > 0) await admin.storage.from(FEEDBACK_BUCKET).remove(paths)

  const { error } = await admin.rpc('eliminar_cuenta', { p_user: user.id })
  if (error) {
    console.error('eliminar cuenta', error)
    return NextResponse.json({ error: 'No pudimos eliminar tu cuenta. No se borró nada; intenta de nuevo.' }, { status: 500 })
  }

  await createServerSupabaseClient().auth.signOut().catch(() => {})
  return NextResponse.json({ ok: true })
}
