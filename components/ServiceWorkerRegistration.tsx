'use client'

import { useEffect } from 'react'
import { canRequestPush } from '@/lib/push-gate'
import { enablePush } from '@/lib/push-client'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      if (!canRequestPush()) return
      if (!('PushManager' in window)) return

      const existing = await registration.pushManager.getSubscription()
      if (existing) return

      // Pide permiso y guarda la suscripción (mismo flujo que "Activar" en Mi cuenta).
      await enablePush()
    }).catch(() => {})
  }, [])

  return null
}
