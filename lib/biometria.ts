// Bloqueo con Face ID o huella (F9). Solo existe dentro del build de
// Capacitor y con un plugin biométrico instalado; en la web no aparece.
//
// PENDIENTE: el repo aún no tiene Capacitor ni plugin biométrico. Se espera
// @aparajita/capacitor-biometric-auth (window.Capacitor.Plugins.BiometricAuth,
// métodos checkBiometry() y authenticate()). Mientras no esté en el build,
// biometricAvailable() devuelve false y la interfaz queda oculta.

export const BLOQUEO_KEY = 'zafi:bloqueo-biometrico';

interface BiometricPlugin {
  checkBiometry: () => Promise<{ isAvailable: boolean }>;
  authenticate: (opts: { reason: string; cancelTitle?: string; allowDeviceCredential?: boolean }) => Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { BiometricAuth?: BiometricPlugin };
}

function plugin(): BiometricPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.BiometricAuth ?? null;
}

/** Corre dentro de Capacitor, hay plugin y el teléfono tiene biometría. */
export async function biometricAvailable(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    return (await p.checkBiometry()).isAvailable;
  } catch {
    return false;
  }
}

/** Pide la biometría. true si la persona se identificó. */
export async function authenticate(): Promise<boolean> {
  const p = plugin();
  if (!p) return true;
  try {
    await p.authenticate({ reason: 'Desbloquea Zafi', cancelTitle: 'Cancelar', allowDeviceCredential: true });
    return true;
  } catch {
    return false;
  }
}

/** La preferencia es del dispositivo (cada teléfono tiene su biometría). */
export function readLockEnabled(): boolean {
  try {
    return window.localStorage.getItem(BLOQUEO_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLockEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(BLOQUEO_KEY, on ? '1' : '0');
  } catch {
    // Sin storage no hay bloqueo.
  }
}
