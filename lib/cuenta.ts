// Lógica pura de la pantalla Mi cuenta (app/cuenta/page.tsx). Sin React ni
// Supabase para poder probarla con vitest.

import type { Currency } from './format';

export interface CurrencyOption {
  code: Currency;
  symbol: string;
  name: string;
}

/** Las 7 monedas que se pueden elegir en Mi cuenta, en este orden. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'GTQ', symbol: 'Q', name: 'Quetzal' },
  { code: 'USD', symbol: '$', name: 'Dólar' },
  { code: 'MXN', symbol: '$', name: 'Peso mexicano' },
  { code: 'COP', symbol: '$', name: 'Peso colombiano' },
  { code: 'HNL', symbol: 'L', name: 'Lempira' },
  { code: 'NIO', symbol: 'C$', name: 'Córdoba' },
  { code: 'CRC', symbol: '₡', name: 'Colón' },
];

/** Moneda elegida; si el código no está en la lista, Quetzal. */
export function currencyOption(code: string | null | undefined): CurrencyOption {
  return CURRENCY_OPTIONS.find((c) => c.code === code) ?? CURRENCY_OPTIONS[0];
}

/** Ayuda de "Mostrar centavos" con un monto de ejemplo en la moneda elegida. */
export function decimalsHint(showDecimals: boolean, currency: Currency): string {
  // Mismo formato que formatMoney (lib/format.ts), sin importar el hook que reexporta.
  const symbol = currencyOption(currency).symbol;
  const n = showDecimals ? 8500.75 : 8501;
  const digits = showDecimals ? 2 : 0;
  const sample = `${symbol} ${new Intl.NumberFormat('es-GT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}`;
  return showDecimals ? `${sample} · precisión total` : `${sample} · más fácil de leer`;
}

/** Iniciales del avatar: dos palabras del nombre o, si no hay, el correo. */
export function initialsFrom(fullName: string | null | undefined, email: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const local = (email ?? '').split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  return local.slice(0, 2).toUpperCase() || '?';
}

export type PlanTone = 'premium' | 'free';

/** Pill del plan en la tarjeta del perfil: solo el plan, sin días de prueba. */
export function planPill(opts: { isPremium: boolean }): { label: string; tone: PlanTone } {
  if (opts.isPremium) return { label: 'Premium', tone: 'premium' };
  return { label: 'Gratis', tone: 'free' };
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "13 oct" — fecha corta para "termina el …" o "próximo cobro el …". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export type MeterTone = 'ok' | 'warn' | 'full';

/** Medidor de uso del plan: porcentaje de la barra y color. */
export function usageMeter(used: number, limit: number): { pct: number; tone: MeterTone } {
  if (limit <= 0) return { pct: 100, tone: 'full' };
  const ratio = Math.max(0, used) / limit;
  const pct = Math.min(100, Math.round(ratio * 100));
  const tone: MeterTone = ratio >= 1 ? 'full' : ratio >= 0.8 ? 'warn' : 'ok';
  return { pct, tone };
}

/** Opciones de "Si dejo de registrar" (días). */
export const INACTIVITY_DAY_OPTIONS = [3, 5, 7, 10, 14];
/** Opciones de "Cierre de mes" (día del mes). */
export const MONTH_CLOSE_DAY_OPTIONS = [1, 2, 3, 5, 7];

export const SUPPORT_EMAIL = 'hola@zafiapp.com';

/** Correo para pedir que eliminemos la cuenta (no hay borrado automático). */
export function accountDeletionMailto(email: string | null | undefined): string {
  const subject = 'Eliminar mi cuenta';
  const body = `Hola, quiero eliminar mi cuenta de Zafi y todos mis datos.\n\nCorreo de la cuenta: ${email ?? ''}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
