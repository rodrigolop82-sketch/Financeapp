import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notificaciones@zafiapp.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  notificationType: 'inactivity' | 'month_close',
): Promise<number> {
  const supabase = getServiceSupabase()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return 0

  let sent = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        JSON.stringify(payload),
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  if (sent > 0) {
    await supabase.from('notification_log').insert({
      user_id: userId,
      type: notificationType,
      payload: payload as unknown as Record<string, unknown>,
    })
  }

  return sent
}

export async function wasNotifiedRecently(
  userId: string,
  type: 'inactivity' | 'month_close',
  withinMs: number,
): Promise<boolean> {
  const supabase = getServiceSupabase()
  const since = new Date(Date.now() - withinMs).toISOString()

  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', since)
    .limit(1)

  return (data?.length ?? 0) > 0
}
