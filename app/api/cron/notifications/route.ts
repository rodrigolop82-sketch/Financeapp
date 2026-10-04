import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushConfigured, sendPushToUser } from '@/lib/push-send'
import { buildCandidates, pickAviso, type AvisoKind } from '@/lib/avisos'
import { loadUserAvisoContext, usersWithDevices } from '@/lib/avisos-data'
import { localToday } from '@/lib/dates'
import { formatMoney } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Cron diario (vercel.json, 8:00 de Guatemala). Para cada usuario con un
 * teléfono suscrito junta sus datos y manda como mucho UN aviso, el de mayor
 * prioridad: vencimiento > tope > cierre > inactividad > ingreso
 * (lib/avisos.ts decide; aquí solo se juntan datos y se envía).
 * Sin CRON_SECRET en producción no corre; sin llaves VAPID no envía nada.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[cron/notifications] Falta CRON_SECRET: no se envían avisos')
    return NextResponse.json({ error: 'Falta configurar CRON_SECRET' }, { status: 503 })
  }
  if (!pushConfigured()) {
    console.warn('[cron/notifications] Faltan las llaves VAPID: no se envían avisos')
    return NextResponse.json({ message: 'Avisos push sin configurar', sent: 0 })
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    console.error('[cron/notifications] Falta SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Falta configurar el servidor' }, { status: 503 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const nowMs = Date.now()
  const today = localToday()
  const fmt = (n: number) => formatMoney(n)
  const results: Record<AvisoKind | 'skippedToday' | 'nothing' | 'noDevice', number> = {
    due: 0, cap: 0, month_end: 0, month_start: 0, inactivity: 0, income: 0, skippedToday: 0, nothing: 0, noDevice: 0,
  }

  for (const userId of await usersWithDevices(admin)) {
    try {
      const ctx = await loadUserAvisoContext(admin, userId, today, nowMs)
      if (!ctx) { results.nothing++; continue }
      const candidates = buildCandidates(ctx.data, ctx.prefs, fmt)
      const aviso = pickAviso(candidates, ctx.prefs, ctx.log, nowMs)
      if (!aviso) {
        if (candidates.length > 0) results.skippedToday++
        else results.nothing++
        continue
      }
      const sent = await sendPushToUser(
        userId,
        { title: aviso.title, body: aviso.body, url: aviso.url, tag: aviso.tag, key: aviso.key },
        aviso.kind,
      )
      if (sent > 0) results[aviso.kind]++
      else results.noDevice++
    } catch (err) {
      console.error('[cron/notifications] Error con un usuario', err)
    }
  }

  return NextResponse.json({ message: 'Notifications processed', today, results })
}
