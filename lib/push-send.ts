import webpush from 'web-push'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DAILY_LIMIT_MS, countsTowardDailyLimit, type NotificationType } from '@/lib/avisos'

/** Sin llaves VAPID no se manda nada (se registra un aviso en el log del servidor). */
export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
}

if (pushConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notificaciones@zafiapp.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export interface PushPayload {
  title: string
  body: string
  /** Pantalla que abre al tocar (public/sw.js → notificationclick). */
  url?: string
  tag?: string
  /** Clave para no repetir el mismo aviso (se guarda en notification_log.payload). */
  key?: string
}

/**
 * Manda el push a todos los teléfonos del usuario y lo anota en
 * notification_log. Devuelve a cuántos llegó (0 sin llaves VAPID o sin
 * suscripciones). No aplica el límite diario: eso lo decide quien llama
 * (lib/avisos.ts pickAviso / usersNotifiedToday).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  notificationType: NotificationType,
): Promise<number> {
  if (!pushConfigured()) {
    console.warn('[push] Faltan las llaves VAPID: no se envió el aviso', notificationType)
    return 0
  }
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
    const { error } = await supabase.from('notification_log').insert({
      user_id: userId,
      type: notificationType,
      payload: payload as unknown as Record<string, unknown>,
    })
    if (error) console.warn('[push] No se pudo anotar en notification_log', error.message)
  }

  return sent
}

/**
 * Máximo 1 aviso por usuario por día (regla compartida por el cron y por
 * Admin › Para reactivar): de `userIds`, quiénes ya recibieron un aviso que
 * cuenta en las últimas 24 h. Si notification_log no existe, nadie.
 */
export async function usersNotifiedToday(
  supabase: SupabaseClient,
  userIds: string[],
  nowMs = Date.now(),
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const since = new Date(nowMs - DAILY_LIMIT_MS).toISOString()
  const { data, error } = await supabase
    .from('notification_log')
    .select('user_id, type')
    .in('user_id', userIds)
    .gte('sent_at', since)
  if (error) console.warn('[push] No se pudo leer notification_log', error.message)
  return new Set(
    ((data ?? []) as { user_id: string; type: string }[])
      .filter((r) => countsTowardDailyLimit(r.type))
      .map((r) => r.user_id),
  )
}
