// Lógica pura del movimiento de la app (Fase 9): curvas, conteos, splash
// y el banner de importación. Sin React para poder probarla con vitest.

import { monthName } from './plan-del-mes';

/** Ease-out cúbica: arranca rápido y frena al final. `t` en [0, 1]. */
export function easeOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - p, 3);
}

/** Valor de un conteo de `from` a `to` tras `elapsed` ms de `duration`. */
export function countUpValue(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return to;
  return from + (to - from) * easeOutCubic(elapsed / duration);
}

// ── Splash ──────────────────────────────────────

/** Se muestra una vez por sesión: llave de sessionStorage. */
export const SPLASH_SESSION_KEY = 'zafi:splash';
/** Tiempo mínimo y máximo del splash (ms). */
export const SPLASH_MIN_MS = 900;
export const SPLASH_MAX_MS = 2500;
/** Duración de la salida (opacity 0 + scale 1.06). */
export const SPLASH_EXIT_MS = 450;

/** Rutas de la app (no la portada, el registro ni los atajos de captura). */
export const SPLASH_ROUTES = [
  '/dashboard', '/transacciones', '/metas', '/mas', '/presupuesto', '/resumen',
  '/cuenta', '/importar', '/deudas', '/cierre-mes', '/chat', '/aprende',
  '/familia', '/mis-fuentes', '/health-score', '/score', '/plan',
];

/** ¿Abrir la app en `pathname` muestra el splash? */
export function isSplashRoute(pathname: string): boolean {
  return SPLASH_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Cuándo sale el splash (ms desde que se montó): cuando los datos están
 * listos, pero nunca antes del mínimo ni después del máximo.
 */
export function splashExitAt(readyAt: number | null): number {
  if (readyAt === null) return SPLASH_MAX_MS;
  return Math.min(SPLASH_MAX_MS, Math.max(SPLASH_MIN_MS, readyAt));
}

/**
 * Corre antes de pintar (en <head>): si el splash ya se vio en esta sesión o
 * la ruta no es de la app, lo oculta por CSS (`html[data-splash=off]`).
 */
export const SPLASH_BOOT_SCRIPT = `(function(){try{var p=location.pathname,r=${JSON.stringify(SPLASH_ROUTES)};var ok=r.some(function(x){return p===x||p.indexOf(x+'/')===0});if(!ok||sessionStorage.getItem('${SPLASH_SESSION_KEY}'))document.documentElement.setAttribute('data-splash','off')}catch(e){document.documentElement.setAttribute('data-splash','off')}})();`;

// ── Banner de importación ───────────────────────

export interface ImportBanner {
  count: number;
  bank: string | null;
  /** 'YYYY-MM' del estado de cuenta. */
  month: string | null;
}

/** Mes ('YYYY-MM') más frecuente entre las fechas 'YYYY-MM-DD'. */
export function dominantMonth(dates: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const d of dates) {
    if (!d || !/^\d{4}-\d{2}/.test(d)) continue;
    const m = d.slice(0, 7);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  // Empate: el mes más reciente.
  counts.forEach((n, m) => {
    if (n > bestN || (n === bestN && best !== null && m > best)) { best = m; bestN = n; }
  });
  return best;
}

/** Query string de `/transacciones` con el banner de importación. */
export function importBannerQuery(b: ImportBanner): string {
  const p = new URLSearchParams({ importados: String(b.count) });
  if (b.bank) p.set('banco', b.bank);
  if (b.month) p.set('mes', b.month);
  return p.toString();
}

/** Lee el banner de los query params (null si no hay o no es válido). */
export function parseImportBanner(params: URLSearchParams): ImportBanner | null {
  const raw = params.get('importados');
  if (raw === null) return null;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 0) return null;
  const bank = params.get('banco')?.trim().slice(0, 40) || null;
  const month = params.get('mes');
  return { count, bank, month: month && /^\d{4}-\d{2}$/.test(month) ? month : null };
}

/**
 * Partes del banner: "{n} movimientos nuevos" (en negritas) y
 * "del estado {banco} de {mes}".
 */
export function importBannerText(b: ImportBanner, today: string): { strong: string; rest: string } {
  const strong = `${b.count} ${b.count === 1 ? 'movimiento nuevo' : 'movimientos nuevos'}`;
  let rest = 'del estado';
  if (b.bank && b.bank !== 'Desconocido') rest += ` ${b.bank}`;
  if (b.month) {
    const name = monthName(b.month);
    if (name) rest += ` de ${name}${b.month.slice(0, 4) !== today.slice(0, 4) ? ` ${b.month.slice(0, 4)}` : ''}`;
  }
  if (rest === 'del estado') rest = 'de tu estado de cuenta';
  return { strong, rest };
}
