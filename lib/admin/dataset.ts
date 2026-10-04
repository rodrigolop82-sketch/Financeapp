// Admin (fase 12): datos de entrada de las métricas y utilidades de fechas.
// Lógica pura: sin React ni Supabase, para probarla con vitest.
// Nunca hay montos aquí: solo fechas, tipo y origen de cada movimiento.

export const DAY_MS = 86_400_000;
/** Zafi opera en Guatemala (UTC−6, sin horario de verano): los días se cortan ahí. */
export const TZ_OFFSET_MS = -6 * 60 * 60 * 1000;

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  plan: string | null;
  trialEndsAt: string | null;
  marketingOptIn: boolean;
  /** auth.users.last_sign_in_at (admin API). Solo cambia al iniciar sesión. */
  lastSignInAt: string | null;
  householdId: string | null;
}

export interface AdminTx {
  householdId: string;
  createdAt: string;
  type: string | null;
  source: string | null;
}

export interface HouseholdActivity {
  /** created_at de cada movimiento en ms, en orden ascendente. */
  times: number[];
  count: number;
  lastAt: number | null;
  hasExpense: boolean;
  hasImport: boolean;
}

export const IMPORT_SOURCES = ['statement', 'csv'];

export function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Índice por hogar para preguntar "¿tuvo movimientos entre A y B?". */
export function indexActivity(txs: AdminTx[]): Map<string, HouseholdActivity> {
  const map = new Map<string, HouseholdActivity>();
  for (const t of txs) {
    const ms = toMs(t.createdAt);
    if (!t.householdId || ms === null) continue;
    let h = map.get(t.householdId);
    if (!h) {
      h = { times: [], count: 0, lastAt: null, hasExpense: false, hasImport: false };
      map.set(t.householdId, h);
    }
    h.times.push(ms);
    h.count++;
    if (h.lastAt === null || ms > h.lastAt) h.lastAt = ms;
    if ((t.type ?? 'expense') === 'expense') h.hasExpense = true;
    if (t.source && IMPORT_SOURCES.includes(t.source)) h.hasImport = true;
  }
  map.forEach((h) => h.times.sort((a, b) => a - b));
  return map;
}

/** ¿Hay algún movimiento en [from, to)? (búsqueda binaria) */
export function hasActivityBetween(h: HouseholdActivity | undefined, from: number, to: number): boolean {
  if (!h || h.times.length === 0) return false;
  let lo = 0;
  let hi = h.times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (h.times[mid] < from) lo = mid + 1;
    else hi = mid;
  }
  return lo < h.times.length && h.times[lo] < to;
}

/** "YYYY-MM-DD" del día en Guatemala. */
export function localDayKey(ms: number): string {
  return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Inicio (ms UTC) del día local que contiene `ms`. */
export function startOfLocalDay(ms: number): number {
  const local = ms + TZ_OFFSET_MS;
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS) - TZ_OFFSET_MS;
}

/** Inicio (ms UTC) del lunes local de la semana que contiene `ms`. */
export function startOfLocalWeek(ms: number): number {
  const day = startOfLocalDay(ms);
  const weekday = new Date(day + TZ_OFFSET_MS).getUTCDay(); // 0 = domingo
  const sinceMonday = (weekday + 6) % 7;
  return day - sinceMonday * DAY_MS;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "12 sep" (fecha local de Guatemala). */
export function dayMonth(ms: number): string {
  const d = new Date(ms + TZ_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "12 sep 2025" si no es del año de `now`; "12 sep" si sí. */
export function dayMonthMaybeYear(ms: number, now: number): string {
  const y = new Date(ms + TZ_OFFSET_MS).getUTCFullYear();
  const ny = new Date(now + TZ_OFFSET_MS).getUTCFullYear();
  return y === ny ? dayMonth(ms) : `${dayMonth(ms)} ${y}`;
}

/** Días completos entre dos instantes (nunca negativo). */
export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

export type PlanLabel = 'Premium' | 'Prueba' | 'Gratis';

/** Premium pagado, prueba de 14 días vigente o gratis. */
export function planLabel(u: Pick<AdminUser, 'plan' | 'trialEndsAt'>, now: number): PlanLabel {
  if (u.plan === 'premium') return 'Premium';
  const end = toMs(u.trialEndsAt);
  if (end !== null && end > now) return 'Prueba';
  return 'Gratis';
}

/**
 * Último acceso: lo más reciente entre el último inicio de sesión
 * (auth.users.last_sign_in_at) y el último movimiento del hogar. Hace falta
 * lo segundo porque la sesión se renueva sola y last_sign_in_at no cambia
 * mientras la persona sigue usando la app. Si no hay nada, la fecha de registro.
 */
export function lastAccessMs(u: AdminUser, h: HouseholdActivity | undefined): number | null {
  const candidates = [toMs(u.lastSignInAt), h?.lastAt ?? null, toMs(u.createdAt)].filter(
    (x): x is number => x !== null,
  );
  return candidates.length ? Math.max(...candidates) : null;
}
