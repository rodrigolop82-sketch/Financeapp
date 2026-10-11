// Admin (fase 12): métricas de Resumen, Retención y Para reactivar.
// Todo se calcula en el servidor a partir de AdminUser/AdminTx; aquí solo hay
// lógica pura para probarla con vitest. Solo conteos, nunca montos.

import {
  DAY_MS,
  type AdminTx,
  type AdminUser,
  type HouseholdActivity,
  type PlanLabel,
  dayMonth,
  dayMonthMaybeYear,
  daysBetween,
  hasActivityBetween,
  indexActivity,
  lastAccessMs,
  localDayKey,
  planLabel,
  startOfLocalDay,
  startOfLocalWeek,
  toMs,
} from './dataset';
import { firstName } from '../feedback';

export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

export function parsePeriod(raw: unknown): PeriodDays {
  const n = Number(raw);
  return (PERIODS as readonly number[]).includes(n) ? (n as PeriodDays) : 30;
}

// ── Deltas ────────────────────────────────────────────────

export type Trend = 'up' | 'down' | 'flat';
export interface Delta {
  label: string;
  trend: Trend;
}

const MINUS = '−';

/** Cambio relativo: "+12%", "−4%", "0%". Sin base anterior: "—". */
export function pctDelta(current: number, previous: number): Delta {
  if (previous <= 0) return current > 0 ? { label: 'nuevo', trend: 'up' } : { label: '—', trend: 'flat' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: '0%', trend: 'flat' };
  return pct > 0 ? { label: `+${pct}%`, trend: 'up' } : { label: `${MINUS}${Math.abs(pct)}%`, trend: 'down' };
}

/** Cambio en puntos porcentuales: "+2 pts", "−1 pt". Sin dato: "—". */
export function ptsDelta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return { label: '—', trend: 'flat' };
  const d = Math.round(current) - Math.round(previous);
  if (d === 0) return { label: '0 pts', trend: 'flat' };
  const unit = Math.abs(d) === 1 ? 'pt' : 'pts';
  return d > 0 ? { label: `+${d} ${unit}`, trend: 'up' } : { label: `${MINUS}${Math.abs(d)} ${unit}`, trend: 'down' };
}

export function rate(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

export function fmtPct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)}%`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Contexto común ────────────────────────────────────────

export interface Ctx {
  users: AdminUser[];
  activity: Map<string, HouseholdActivity>;
  txs: AdminTx[];
  now: number;
}

export function buildCtx(users: AdminUser[], txs: AdminTx[], now: number): Ctx {
  return { users, txs, activity: indexActivity(txs), now };
}

function regMs(u: AdminUser): number {
  return toMs(u.createdAt) ?? 0;
}

function act(ctx: Ctx, u: AdminUser): HouseholdActivity | undefined {
  return u.householdId ? ctx.activity.get(u.householdId) : undefined;
}

/** ¿El hogar de la persona tuvo movimientos en su semana `k` desde el registro? */
export function activeInWeek(ctx: Ctx, u: AdminUser, k: number): boolean {
  const r = regMs(u);
  return hasActivityBetween(act(ctx, u), r + k * 7 * DAY_MS, r + (k + 1) * 7 * DAY_MS);
}

/** Ya pasó completa su semana `k`. */
export function weekComplete(ctx: Ctx, u: AdminUser, k: number): boolean {
  return regMs(u) + (k + 1) * 7 * DAY_MS <= ctx.now;
}

function usersRegisteredBetween(ctx: Ctx, from: number, to: number): AdminUser[] {
  return ctx.users.filter((u) => {
    const r = regMs(u);
    return r >= from && r < to;
  });
}

/** Hogares con al menos un movimiento creado en [from, to). */
export function activeHouseholds(ctx: Ctx, from: number, to: number): number {
  let n = 0;
  ctx.activity.forEach((h) => {
    if (hasActivityBetween(h, from, to)) n++;
  });
  return n;
}

// ── Resumen ───────────────────────────────────────────────

export interface Kpi {
  key: 'activos' | 'registros' | 'retencion' | 'premium';
  label: string;
  value: string;
  delta: Delta;
  sub: string;
}

export interface FunnelStep {
  label: string;
  value: number;
  /** % sobre los registrados. */
  pctOfFirst: number;
  worst: boolean;
  final: boolean;
}

export interface Funnel {
  steps: FunnelStep[];
  insight: string | null;
}

export interface Bar {
  label: string;
  value: number;
}

export interface SourceShare {
  key: 'manual' | 'importacion' | 'voz' | 'foto';
  label: string;
  count: number;
  pct: number;
}

export interface Resumen {
  days: PeriodDays;
  kpis: Kpi[];
  funnel: Funnel;
  activity: { bars: Bar[]; total: number; subtitle: string; weekly: boolean };
  sources: SourceShare[];
}

const FUNNEL_LABELS = [
  'Se registraron',
  'Capturaron su 1er gasto',
  'Activos en semana 1',
  'Activos en semana 2',
  'Pasaron a premium',
];

const FUNNEL_HINTS = [
  '',
  'Ahí conviene el recordatorio del día 3.',
  'Ahí conviene invitar a importar su primer estado de cuenta.',
  'Ahí conviene un aviso semanal con cómo les va.',
];

/**
 * Embudo de quienes se registraron en el periodo. Los pasos 2–4 son
 * acumulativos (para estar activo en la semana 2 hay que haber estado en la
 * 1); "Pasaron a premium" cuenta a todos los registrados con plan premium.
 * Mayor fuga: la peor proporción entre pasos consecutivos del 1 al 4.
 */
export function computeFunnel(ctx: Ctx, cohort: AdminUser[]): Funnel {
  const captured = cohort.filter((u) => act(ctx, u)?.hasExpense);
  const w1 = captured.filter((u) => activeInWeek(ctx, u, 1));
  const w2 = w1.filter((u) => activeInWeek(ctx, u, 2));
  const premium = cohort.filter((u) => u.plan === 'premium' || u.plan === 'family');
  const values = [cohort.length, captured.length, w1.length, w2.length, premium.length];

  let worst = -1;
  let worstRatio = 1;
  for (let i = 1; i <= 3; i++) {
    if (values[i - 1] <= 0) continue;
    const r = values[i] / values[i - 1];
    if (r < worstRatio) {
      worstRatio = r;
      worst = i;
    }
  }

  const first = values[0];
  const steps = values.map((value, i) => ({
    label: FUNNEL_LABELS[i],
    value,
    pctOfFirst: first > 0 ? Math.round((value / first) * 100) : 0,
    worst: i === worst,
    final: i === 4,
  }));
  const insight =
    worst > 0
      ? `de “${FUNNEL_LABELS[worst - 1].toLowerCase()}” a “${FUNNEL_LABELS[worst].toLowerCase()}” se pierde el ${Math.round((1 - worstRatio) * 100)}%. ${FUNNEL_HINTS[worst]}`
      : null;
  return { steps, insight };
}

const SOURCE_GROUPS: { key: SourceShare['key']; label: string; sources: (string | null)[] }[] = [
  { key: 'manual', label: 'Manual', sources: ['manual', 'text', null] },
  { key: 'importacion', label: 'Importación', sources: ['statement', 'csv'] },
  { key: 'voz', label: 'Voz', sources: ['voice'] },
  { key: 'foto', label: 'Foto', sources: ['ocr'] },
];

/**
 * "Cómo capturan", según transactions.source: manual y text (escrito en la
 * hoja de agregar) → Manual; statement y csv → Importación; voice → Voz;
 * ocr (foto de recibo o notificación) → Foto. Un origen desconocido cuenta
 * como Manual.
 */
export function sourceGroup(source: string | null | undefined): SourceShare['key'] {
  const s = source ?? null;
  return SOURCE_GROUPS.find((g) => g.sources.includes(s))?.key ?? 'manual';
}

export function computeSources(txs: AdminTx[]): SourceShare[] {
  const counts: Record<SourceShare['key'], number> = { manual: 0, importacion: 0, voz: 0, foto: 0 };
  for (const t of txs) counts[sourceGroup(t.source)]++;
  const total = txs.length;
  return SOURCE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: counts[g.key],
    pct: total > 0 ? Math.round((counts[g.key] / total) * 100) : 0,
  }));
}

/**
 * Movimientos creados por día (7 y 30 días) o por semana (90 días), de lo
 * más viejo a lo más reciente. La última barra es hoy / la semana en curso.
 */
export function computeActivityBars(txs: AdminTx[], days: PeriodDays, now: number): { bars: Bar[]; total: number; subtitle: string; weekly: boolean } {
  const today = startOfLocalDay(now);
  const start = today - (days - 1) * DAY_MS;
  const perDay = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    const ms = toMs(t.createdAt);
    if (ms === null || ms < start || ms > now) continue;
    const k = localDayKey(ms);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
    total++;
  }
  const daily: Bar[] = [];
  for (let i = 0; i < days; i++) {
    const ms = start + i * DAY_MS;
    daily.push({ label: dayMonth(ms), value: perDay.get(localDayKey(ms)) ?? 0 });
  }
  if (days <= 30) {
    return { bars: daily, total, subtitle: `Últimos ${days} días`, weekly: false };
  }
  // Semanas de 7 días contadas desde hoy hacia atrás; la primera puede ser corta.
  const bars: Bar[] = [];
  for (let end = daily.length; end > 0; end -= 7) {
    const chunk = daily.slice(Math.max(0, end - 7), end);
    bars.unshift({
      label: `Semana del ${chunk[0].label}`,
      value: chunk.reduce((a, b) => a + b.value, 0),
    });
  }
  return { bars, total, subtitle: `Últimos ${days} días, por semana`, weekly: true };
}

/** Retención semana 4 de un grupo: activos en su semana 4 / todos (semana ya cerrada). */
function s4Of(ctx: Ctx, cohort: AdminUser[]): number | null {
  const eligible = cohort.filter((u) => weekComplete(ctx, u, 4));
  return rate(eligible.filter((u) => activeInWeek(ctx, u, 4)).length, eligible.length);
}

export function computeResumen(ctx: Ctx, days: PeriodDays): Resumen {
  const { now } = ctx;
  const P = days * DAY_MS;
  const W = 7 * DAY_MS;

  // Activos esta semana: hogares con ≥1 movimiento en 7 días vs los 7 anteriores.
  const activeNow = activeHouseholds(ctx, now - W, now + 1);
  const activePrev = activeHouseholds(ctx, now - 2 * W, now - W);

  // Registros nuevos del periodo vs el periodo anterior.
  const cohort = usersRegisteredBetween(ctx, now - P, now + 1);
  const prevCohort = usersRegisteredBetween(ctx, now - 2 * P, now - P);

  // Retención semana 4: quienes ya cerraron su semana 4 (se registraron hace ≥ 35 días).
  const lag4 = 35 * DAY_MS;
  const retNow = s4Of(ctx, usersRegisteredBetween(ctx, now - lag4 - P, now - lag4));
  const retPrev = s4Of(ctx, usersRegisteredBetween(ctx, now - lag4 - 2 * P, now - lag4 - P));

  // Prueba → premium: quienes ya terminaron su prueba de 14 días.
  const lagT = 14 * DAY_MS;
  const trials = usersRegisteredBetween(ctx, now - lagT - P, now - lagT);
  const trialsPrev = usersRegisteredBetween(ctx, now - lagT - 2 * P, now - lagT - P);
  const paid = trials.filter((u) => u.plan === 'premium' || u.plan === 'family').length;
  const paidPrev = trialsPrev.filter((u) => u.plan === 'premium' || u.plan === 'family').length;
  const convNow = rate(paid, trials.length);
  const convPrev = rate(paidPrev, trialsPrev.length);

  const kpis: Kpi[] = [
    { key: 'activos', label: 'Activos esta semana', value: fmtInt(activeNow), delta: pctDelta(activeNow, activePrev), sub: 'vs semana anterior' },
    { key: 'registros', label: 'Registros nuevos', value: fmtInt(cohort.length), delta: pctDelta(cohort.length, prevCohort.length), sub: `en ${days} días` },
    { key: 'retencion', label: 'Retención semana 4', value: fmtPct(retNow), delta: ptsDelta(retNow, retPrev), sub: days === 7 ? 'grupo de hace 5 semanas' : 'promedio de grupos' },
    { key: 'premium', label: 'Prueba → premium', value: fmtPct(convNow), delta: ptsDelta(convNow, convPrev), sub: `${paid} de ${trials.length} ${trials.length === 1 ? 'prueba' : 'pruebas'}` },
  ];

  // Mismo rango que las barras: los últimos `days` días locales, hoy incluido.
  const from = startOfLocalDay(now) - (days - 1) * DAY_MS;
  const periodTxs = ctx.txs.filter((t) => {
    const ms = toMs(t.createdAt);
    return ms !== null && ms >= from && ms <= now;
  });

  return {
    days,
    kpis,
    funnel: computeFunnel(ctx, cohort),
    activity: computeActivityBars(ctx.txs, days, now),
    sources: computeSources(periodTxs),
  };
}

// ── Retención ─────────────────────────────────────────────

export const COHORT_WEEKS = 5; // Sem 0 … Sem 4
export const COHORT_ROWS = 6;

export interface CohortRow {
  label: string;
  size: number;
  /** % por semana (0–100) o null si esa semana aún no termina para nadie del grupo. */
  cells: (number | null)[];
}

export interface Retencion {
  cohorts: CohortRow[];
  s1: number | null;
  s4: number | null;
  imports: { withImport: number | null; withoutImport: number | null; nWith: number; nWithout: number };
  retains: { title: string; sub: string; positive: boolean };
  reading: string;
}

/**
 * Retención de un grupo en la semana k: de quienes ya cerraron su semana k,
 * cuántos tuvieron movimientos en ella. La semana 0 es el registro (100%).
 */
export function cohortCell(ctx: Ctx, cohort: AdminUser[], k: number): number | null {
  if (cohort.length === 0) return null;
  if (k === 0) return 100;
  const eligible = cohort.filter((u) => weekComplete(ctx, u, k));
  const r = rate(eligible.filter((u) => activeInWeek(ctx, u, k)).length, eligible.length);
  return r === null ? null : Math.round(r);
}

/** Color de la celda: azul con opacidad .08 + v·.85; texto blanco desde 70%. */
export function heatCell(v: number | null): { bg: string; light: boolean } {
  if (v === null) return { bg: 'transparent', light: false };
  const a = 0.08 + (Math.max(0, Math.min(100, v)) / 100) * 0.85;
  return { bg: `rgba(37,99,235,${Number(a.toFixed(3))})`, light: v >= 70 };
}

function weekRate(ctx: Ctx, users: AdminUser[], k: number): { rate: number | null; n: number } {
  const eligible = users.filter((u) => weekComplete(ctx, u, k));
  return { rate: rate(eligible.filter((u) => activeInWeek(ctx, u, k)).length, eligible.length), n: eligible.length };
}

export function computeRetencion(ctx: Ctx): Retencion {
  const { now, users } = ctx;
  const thisWeek = startOfLocalWeek(now);
  const cohorts: CohortRow[] = [];
  for (let i = COHORT_ROWS - 1; i >= 0; i--) {
    const from = thisWeek - i * 7 * DAY_MS;
    const group = usersRegisteredBetween(ctx, from, from + 7 * DAY_MS);
    cohorts.push({
      label: dayMonthMaybeYear(from, now),
      size: group.length,
      cells: Array.from({ length: COHORT_WEEKS }, (_, k) => cohortCell(ctx, group, k)),
    });
  }

  // S1 y S4 con todos los usuarios que ya cerraron esa semana.
  const s1 = weekRate(ctx, users, 1).rate;
  const s4 = weekRate(ctx, users, 4).rate;

  // Lo que más retiene: S4 de quienes importaron un estado de cuenta vs quienes no.
  const importers = users.filter((u) => act(ctx, u)?.hasImport);
  const others = users.filter((u) => !act(ctx, u)?.hasImport);
  const wi = weekRate(ctx, importers, 4);
  const wo = weekRate(ctx, others, 4);
  let retains: Retencion['retains'];
  if (wi.rate === null) {
    retains = { title: 'Aún sin datos', sub: 'Nadie que importó un estado lleva 5 semanas en Zafi', positive: false };
  } else if (wo.rate === null || Math.round(wi.rate) > Math.round(wo.rate)) {
    retains = {
      title: 'Importar un estado',
      sub: `S4 de ${fmtPct(wi.rate)} vs ${fmtPct(wo.rate)} de quienes no importan`,
      positive: true,
    };
  } else {
    retains = {
      title: 'Importar no marca diferencia',
      sub: `S4 de ${fmtPct(wi.rate)} vs ${fmtPct(wo.rate)} de quienes no importan`,
      positive: false,
    };
  }

  // Lectura: la mayor caída entre semanas consecutivas (con todos los usuarios).
  const curve = [100, ...[1, 2, 3, 4].map((k) => weekRate(ctx, users, k).rate)];
  let worstK = -1;
  let worstLoss = 0;
  for (let k = 0; k < 4; k++) {
    const a = curve[k];
    const b = curve[k + 1];
    if (a === null || b === null || a <= 0) continue;
    const loss = 1 - b / a;
    if (loss > worstLoss) {
      worstLoss = loss;
      worstK = k;
    }
  }
  let reading: string;
  if (worstK < 0) {
    reading = 'Aún no hay suficientes registros con semanas cerradas para leer la retención.';
  } else {
    const tenths = Math.round(worstLoss * 10);
    reading = `la mayor caída es entre la semana ${worstK} y la ${worstK + 1}: ${tenths} de cada 10 no vuelven.`;
    if (worstK === 0) {
      reading += ' Un recordatorio el día 3 y una invitación a importar su primer estado de cuenta son las dos palancas más claras.';
    }
  }

  return {
    cohorts,
    s1,
    s4,
    imports: { withImport: wi.rate, withoutImport: wo.rate, nWith: wi.n, nWithout: wo.n },
    retains,
    reading,
  };
}

// ── Usuarios y Para reactivar ─────────────────────────────

export type Situation = 'Nunca capturó' | 'Se enfrió' | 'Dejó de usar';
/** Situación en la vista de Usuarios: la de inactivos o, si está activo, una de estas. */
export type UserSituation = Situation | 'Activo' | 'Recién llegó';
export type UserStatus = 'Activo' | 'Inactivo';

export const INACTIVE_MIN_DAYS = 7;

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  registeredAt: string;
  registeredLabel: string;
  lastAccessAt: string | null;
  daysInactive: number;
  txCount: number;
  plan: PlanLabel;
  status: UserStatus;
  situation: UserSituation;
  marketingOptIn: boolean;
}

export interface InactiveRow extends UserRow {
  status: 'Inactivo';
  situation: Situation;
}

export function situationOf(txCount: number, daysInactive: number): Situation {
  if (txCount === 0) return 'Nunca capturó';
  return daysInactive > 30 ? 'Dejó de usar' : 'Se enfrió';
}

/** Primer nombre de users.full_name o "" (reutiliza el de "Envíanos tu idea"). */
export function firstNameOf(fullName: string | null | undefined): string {
  return firstName(fullName) ?? '';
}

/**
 * Todos los usuarios. Inactivo: lleva ≥ 7 días sin entrar, o nunca capturó un
 * movimiento y se registró hace ≥ 7 días. Ordenado de menos a más días sin
 * entrar.
 */
export function computeUsuarios(ctx: Ctx): UserRow[] {
  const { now } = ctx;
  const rows: UserRow[] = [];
  for (const u of ctx.users) {
    const h = act(ctx, u);
    const last = lastAccessMs(u, h);
    const daysInactive = last === null ? 0 : daysBetween(last, now);
    const txCount = h?.count ?? 0;
    const daysSinceReg = daysBetween(regMs(u), now);
    const inactive = daysInactive >= INACTIVE_MIN_DAYS || (txCount === 0 && daysSinceReg >= INACTIVE_MIN_DAYS);
    rows.push({
      id: u.id,
      email: u.email,
      firstName: firstNameOf(u.fullName),
      registeredAt: u.createdAt,
      registeredLabel: dayMonthMaybeYear(regMs(u), now),
      lastAccessAt: last === null ? null : new Date(last).toISOString(),
      daysInactive,
      txCount,
      plan: planLabel(u, now),
      status: inactive ? 'Inactivo' : 'Activo',
      situation: inactive ? situationOf(txCount, daysInactive) : txCount === 0 ? 'Recién llegó' : 'Activo',
      marketingOptIn: u.marketingOptIn,
    });
  }
  return rows.sort((a, b) => a.daysInactive - b.daysInactive || a.email.localeCompare(b.email));
}

/** Para reactivar: solo los inactivos de computeUsuarios. */
export function computeInactivos(ctx: Ctx): InactiveRow[] {
  return computeUsuarios(ctx).filter((r): r is InactiveRow => r.status === 'Inactivo');
}

export const INACTIVE_FILTERS = ['Todos', '7–14 días', '15–30 días', '+30 días', 'Nunca capturó'] as const;
export type InactiveFilter = (typeof INACTIVE_FILTERS)[number];

export function parseInactiveFilter(raw: unknown): InactiveFilter {
  return (INACTIVE_FILTERS as readonly string[]).includes(raw as string) ? (raw as InactiveFilter) : 'Todos';
}

export function matchesInactiveFilter(r: Pick<InactiveRow, 'daysInactive' | 'txCount'>, f: InactiveFilter): boolean {
  switch (f) {
    case 'Todos': return true;
    case '7–14 días': return r.daysInactive >= 7 && r.daysInactive <= 14;
    case '15–30 días': return r.daysInactive >= 15 && r.daysInactive <= 30;
    case '+30 días': return r.daysInactive > 30;
    case 'Nunca capturó': return r.txCount === 0;
  }
}

export const USER_FILTERS = ['Todos', 'Activos', 'Inactivos', 'Nunca capturó'] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export function parseUserFilter(raw: unknown): UserFilter {
  return (USER_FILTERS as readonly string[]).includes(raw as string) ? (raw as UserFilter) : 'Todos';
}

export function matchesUserFilter(r: Pick<UserRow, 'status' | 'txCount'>, f: UserFilter): boolean {
  switch (f) {
    case 'Todos': return true;
    case 'Activos': return r.status === 'Activo';
    case 'Inactivos': return r.status === 'Inactivo';
    case 'Nunca capturó': return r.txCount === 0;
  }
}

/** Búsqueda por correo o nombre, sin tildes ni mayúsculas. */
export function matchesUserSearch(r: Pick<UserRow, 'email' | 'firstName'>, query: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query.trim());
  return !q || norm(r.email).includes(q) || norm(r.firstName).includes(q);
}

/** Seleccionados (si hay) o, si no, los que pasan `matches`. */
export function pickForExport<T extends { id: string }>(
  rows: T[],
  ids: string[] | null | undefined,
  matches: (row: T) => boolean,
): T[] {
  if (ids && ids.length > 0) {
    const set = new Set(ids);
    return rows.filter((r) => set.has(r.id));
  }
  return rows.filter(matches);
}
