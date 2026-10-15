// Ocultar saldos (F9). Puro, sin React ni Supabase.

/** Copia local de la preferencia, para no mostrar montos antes de leerla. */
export const OCULTAR_SALDOS_KEY = 'zafi:ocultar-saldos';

export const MASK = '••••';

type Fmt = (amount: number, ...rest: never[]) => string;

/** "Q ••••" (o "$ ••••"): el símbolo de la moneda sin el número. */
export function maskedText(fmt: (n: number) => string): string {
  const base = fmt(0);
  const masked = base.replace(/[\d][\d.,\s]*/, MASK);
  return masked === base ? `${base} ${MASK}` : masked;
}

/** Formateador que oculta todos los montos cuando `hidden` es true. */
export function maskFormatter<F extends Fmt>(fmt: F, hidden: boolean): F {
  if (!hidden) return fmt;
  const text = maskedText(fmt as unknown as (n: number) => string);
  return ((() => text) as unknown) as F;
}

/** Lee la copia local: true/false, o null si no hay (o no hay storage). */
export function readLocalHidden(): boolean | null {
  try {
    const v = window.localStorage.getItem(OCULTAR_SALDOS_KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export function writeLocalHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(OCULTAR_SALDOS_KEY, hidden ? '1' : '0');
  } catch {
    // Sin storage (modo privado): la preferencia sigue en la cuenta.
  }
}
