// Push de los lunes (8:00 Guatemala, cron diario): "Tu semana en Zafi está
// lista". Gratis; respeta weekly_snapshot_enabled y no se repite por
// (hogar, semana). Solo servidor.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser } from '../push-send'
import { deviceHouseholds } from '../recurring/cron'
import { loadWeeklySnapshot, weekBounds } from './data'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export function weeklySnapshotCopy(total: string): { title: string; body: string } {
  return { title: 'Tu semana', body: `Tu semana en Zafi está lista: gastaste ${total}. Tócala para verla.` }
}

export async function sendWeeklySnapshots(admin: Admin, deviceUserIds: string[], today: string, fmt: (n: number) => string): Promise<number> {
  const { data: prefs } = await admin.from('notification_preferences').select('user_id, weekly_snapshot_enabled').in('user_id', deviceUserIds)
  const off = new Set(((prefs ?? []) as { user_id: string; weekly_snapshot_enabled?: boolean | null }[])
    .filter((p) => p.weekly_snapshot_enabled === false).map((p) => p.user_id))

  let sent = 0
  for (const [hid, members] of Array.from((await deviceHouseholds(admin, deviceUserIds)).entries())) {
    const to = members.filter((u) => !off.has(u))
    if (to.length === 0) continue
    try {
      const bounds = await weekBounds(admin, hid, today)
      if (!bounds) continue
      const { snapshot } = await loadWeeklySnapshot(admin, hid, bounds.latest)
      if (snapshot.isSparse) continue
      const key = `weekly_snapshot:${hid}:${bounds.latest}`
      const copy = weeklySnapshotCopy(fmt(snapshot.totalVariable))
      for (const userId of to) {
        const { data: prev } = await admin.from('notification_log').select('id').eq('user_id', userId).contains('payload', { key }).limit(1)
        if (prev && prev.length > 0) continue
        sent += await sendPushToUser(userId, { ...copy, url: '/resumen/semana', tag: 'weekly-snapshot', key }, 'weekly_snapshot')
      }
    } catch (e) {
      console.error('[cron/weekly-snapshot] Error con un hogar', hid, e instanceof Error ? e.message : 'error')
    }
  }
  return sent
}
