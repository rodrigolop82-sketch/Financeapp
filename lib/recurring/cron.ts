// Cron diario: recordatorios antes del cobro y alertas de alza (Premium).
// Reutiliza push-send y notification_log; no hay un segundo sistema de push.
// Solo servidor (service role).

import type { SupabaseClient } from '@supabase/supabase-js'
import { hasFeature } from '../entitlements/features'
import { sendPushToUser, usersNotifiedToday } from '../push-send'
import { getRecurringCharges } from './data'
import { recurringNotices } from './notify'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

async function alreadySent(admin: Admin, userId: string, key: string): Promise<boolean> {
  const { data } = await admin.from('notification_log').select('id').eq('user_id', userId).contains('payload', { key }).limit(1)
  return !!data && data.length > 0
}

/** Hogares activos de los usuarios con teléfono suscrito, con sus miembros que escriben. */
export async function deviceHouseholds(admin: Admin, userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await admin
      .from('household_members')
      .select('household_id, user_id, access, households(archived_at)')
      .in('user_id', userIds.slice(i, i + 200))
    type Row = { household_id: string; user_id: string; access: string | null; households: { archived_at: string | null } | { archived_at: string | null }[] | null }
    for (const r of (data ?? []) as Row[]) {
      const h = Array.isArray(r.households) ? r.households[0] : r.households
      if (h?.archived_at || r.access === 'view') continue
      out.set(r.household_id, [...(out.get(r.household_id) ?? []), r.user_id])
    }
  }
  return out
}

export async function sendRecurringNotices(admin: Admin, deviceUserIds: string[], today: string, fmt: (n: number) => string): Promise<number> {
  let sent = 0
  const notifiedToday = await usersNotifiedToday(admin, deviceUserIds)
  for (const [hid, members] of Array.from((await deviceHouseholds(admin, deviceUserIds)).entries())) {
    try {
      const [reminders, priceAlerts] = await Promise.all([
        hasFeature(hid, 'recurring.reminders'),
        hasFeature(hid, 'recurring.price_alerts'),
      ])
      if (!reminders && !priceAlerts) continue
      const data = await getRecurringCharges(admin, hid, { today, remindersEnabled: reminders })
      for (const n of recurringNotices(hid, data.charges, today, fmt, { reminders, priceAlerts })) {
        for (const userId of members) {
          // La alerta de alza cuenta para el máximo de 1 aviso al día; si hoy ya
          // hubo uno, sale otro día (la clave evita repetirla).
          if (n.kind === 'price_alert' && notifiedToday.has(userId)) continue
          if (await alreadySent(admin, userId, n.key)) continue
          const ok = await sendPushToUser(userId, { title: n.title, body: n.body, url: n.url, tag: n.key, key: n.key }, n.kind)
          if (ok > 0) {
            sent += ok
            if (n.kind === 'price_alert') notifiedToday.add(userId)
          }
        }
      }
    } catch (e) {
      console.error('[cron/recurring] Error con un hogar', hid, e instanceof Error ? e.message : 'error')
    }
  }
  return sent
}
