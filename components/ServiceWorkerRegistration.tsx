'use client'

import { useEffect } from 'react'

/**
 * Solo registra el service worker. Los avisos NO se piden al cargar: la hoja
 * "¿Te avisamos lo importante?" (components/avisos/PushOfferSheet.tsx) los
 * ofrece tras el primer gasto guardado o desde Mi cuenta.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
