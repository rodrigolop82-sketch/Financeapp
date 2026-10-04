// Suscripción a avisos push desde el navegador. Solo la usa la hoja
// "¿Te avisamos lo importante?" (components/avisos/PushOfferSheet.tsx), que
// llama a enablePush() cuando el usuario toca "Activar avisos". Nunca se
// pide permiso al cargar la app.

import { canRequestPush } from '@/lib/push-gate'
import { createClient } from '@/lib/supabase'
import { resolvePushStatus, type PushStatus } from '@/lib/push-status'

function vapidKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined
}

function hasPushApis(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!hasPushApis()) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  } catch {
    return null
  }
}

/** Estado actual de los avisos en este navegador. */
export async function getPushStatus(): Promise<PushStatus> {
  const apis = hasPushApis()
  const reg = apis ? await registration() : null
  const subscribed = reg ? !!(await reg.pushManager.getSubscription().catch(() => null)) : false
  return resolvePushStatus({
    hasServiceWorker: apis && !!reg,
    hasPushManager: apis,
    hasVapidKey: !!vapidKey(),
    standalone: canRequestPush(),
    permission: apis ? Notification.permission : 'unknown',
    subscribed,
  })
}

/**
 * Pide permiso (si hace falta), se suscribe y guarda la suscripción en
 * /api/push/subscribe. Devuelve el estado final.
 */
export async function enablePush(): Promise<PushStatus> {
  const status = await getPushStatus()
  if (status !== 'off') return status

  const reg = await registration()
  const key = vapidKey()
  if (!reg || !key) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }))

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return 'off'

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    })
    return res.ok ? 'on' : 'off'
  } catch {
    // El usuario bloqueó los avisos o el navegador falló al suscribirse.
    return 'off'
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
