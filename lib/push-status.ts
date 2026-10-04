// Estado de "Avisos en el teléfono". Lógica pura: el código del navegador
// (lib/push-client.ts) junta los datos y esta función decide qué mostrar.

export type PushStatus =
  /** El navegador no tiene service worker / Push API o falta la llave VAPID. */
  | 'unsupported'
  /** Solo se piden permisos con Zafi instalada (ver lib/push-gate.ts). */
  | 'needs-install'
  /** El usuario los bloqueó en el sistema. */
  | 'denied'
  /** Se pueden activar. */
  | 'off'
  /** Hay suscripción activa en este teléfono. */
  | 'on';

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasVapidKey: boolean;
  /** canRequestPush(): app instalada (standalone). */
  standalone: boolean;
  permission: NotificationPermission | 'unknown';
  subscribed: boolean;
}

export function resolvePushStatus(env: PushEnv): PushStatus {
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasVapidKey) return 'unsupported';
  if (env.subscribed && env.permission === 'granted') return 'on';
  if (env.permission === 'denied') return 'denied';
  if (!env.standalone) return 'needs-install';
  return 'off';
}

/** Texto de ayuda de la fila según el estado. */
export function pushHint(status: PushStatus): string {
  switch (status) {
    case 'on': return 'Activados en este teléfono';
    case 'denied': return 'Los bloqueaste; actívalos en los ajustes del teléfono';
    case 'needs-install': return 'Agrega Zafi a tu pantalla de inicio para activarlos';
    case 'unsupported': return 'Este navegador no permite avisos';
    default: return 'Para recordatorios y alertas de topes';
  }
}
