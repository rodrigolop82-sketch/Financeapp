import { getPlatformContext } from '@/lib/platform-detection'

/**
 * ¿Se puede pedir permiso de avisos en este navegador?
 * - App instalada (standalone): sí.
 * - iPhone/iPad en Safari sin instalar: no; iOS solo entrega avisos web a
 *   las apps agregadas a la pantalla de inicio (la hoja de la fase 13
 *   muestra antes cómo agregarla).
 * - Navegadores dentro de otras apps (Instagram, WhatsApp…): no.
 * - Android y escritorio en el navegador: sí.
 *
 * Nunca se pide al cargar: solo tras el primer gasto guardado o desde
 * Mi cuenta (components/avisos/PushOfferSheet.tsx).
 */
export function canRequestPush(): boolean {
  const ctx = getPlatformContext()
  if (ctx.isStandalone) return true
  return ctx.os !== 'ios' && !ctx.isInAppBrowser
}
