// Avisos en el teléfono (fase 13): qué aviso le toca a cada usuario hoy.
// Puro (sin Supabase ni web-push) para probarlo con vitest. El cron
// (app/api/cron/notifications) junta los datos con lib/avisos-data.ts,
// llama a buildCandidates() + pickAviso() y envía el elegido.
//
// Reglas:
// - Máximo 1 aviso por usuario por día: si ya recibió uno que cuenta en las
//   últimas 24 h (ventana móvil, así tampoco hay dos el mismo día), no se
//   manda nada. 'apple_pay' no cuenta: es la respuesta a un pago que la
//   persona acaba de hacer.
// - Prioridad: vencimiento > tope > cierre > (inicio de mes) > inactividad > ingreso.
// - Cada aviso lleva una `key` que se guarda en notification_log.payload
//   para no repetir el mismo (el mismo pago, el mismo tope en el mes…).

import { analyzeMonth, longMonth, verdictSaved, type CtfCategory, type CtfTx } from './como-te-fue';
import { planLeaves, planSummary, type PlanIncome, type PlanSubItem } from './plan-del-mes';
import { CAP_META, type CapKey } from './recomendaciones';

/** Tipos que se guardan en notification_log.type. */
export type NotificationType =
  | 'due' | 'cap' | 'month_end' | 'month_start' | 'inactivity' | 'income'
  | 'month_close' | 'apple_pay' | 'household';

/** Tipos que elige el cron, en orden de prioridad. */
export type AvisoKind = 'due' | 'cap' | 'month_end' | 'month_start' | 'inactivity' | 'income';

export const AVISO_PRIORITY: AvisoKind[] = ['due', 'cap', 'month_end', 'month_start', 'inactivity', 'income'];

export const DAY_MS = 86_400_000;
/** Ventana del límite diario. */
export const DAILY_LIMIT_MS = DAY_MS;
/** Un tope avisa al llegar a este % del tope. */
export const CAP_WARN_RATIO = 0.85;
/** Entre dos avisos de inactividad pasan al menos 7 días. */
export const INACTIVITY_REPEAT_MS = 7 * DAY_MS;

/** ¿Este tipo cuenta para el máximo de 1 aviso al día? */
export function countsTowardDailyLimit(type: string): boolean {
  // Los avisos entre personas del hogar no gastan el aviso del día.
  return type !== 'apple_pay' && type !== 'household';
}

export interface LogEntry {
  type: string;
  sent_at: string;
  payload?: { key?: string } | null;
}

/** ¿Ya recibió un aviso que cuenta en la ventana diaria? */
export function notifiedWithinDay(log: LogEntry[], nowMs: number): boolean {
  return log.some((l) => countsTowardDailyLimit(l.type) && nowMs - Date.parse(l.sent_at) < DAILY_LIMIT_MS);
}

export interface AvisoPrefs {
  due_enabled: boolean;
  cap_enabled: boolean;
  inactivity_enabled: boolean;
  month_close_enabled: boolean;
  income_enabled: boolean;
  inactivity_threshold_days: number;
  month_close_day: number;
}

export const DEFAULT_AVISO_PREFS: AvisoPrefs = {
  due_enabled: true,
  cap_enabled: true,
  inactivity_enabled: true,
  month_close_enabled: true,
  income_enabled: false,
  inactivity_threshold_days: 5,
  month_close_day: 2,
};

/** Fila de notification_preferences (sin las columnas nuevas si falta la migración). */
export function resolveAvisoPrefs(row: Partial<Record<keyof AvisoPrefs, unknown>> | null | undefined): AvisoPrefs {
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const int = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : d);
  const r = row ?? {};
  return {
    due_enabled: bool(r.due_enabled, DEFAULT_AVISO_PREFS.due_enabled),
    cap_enabled: bool(r.cap_enabled, DEFAULT_AVISO_PREFS.cap_enabled),
    inactivity_enabled: bool(r.inactivity_enabled, DEFAULT_AVISO_PREFS.inactivity_enabled),
    month_close_enabled: bool(r.month_close_enabled, DEFAULT_AVISO_PREFS.month_close_enabled),
    income_enabled: bool(r.income_enabled, DEFAULT_AVISO_PREFS.income_enabled),
    inactivity_threshold_days: int(r.inactivity_threshold_days, DEFAULT_AVISO_PREFS.inactivity_threshold_days),
    month_close_day: int(r.month_close_day, DEFAULT_AVISO_PREFS.month_close_day),
  };
}

/** Switch de preferencias que enciende cada tipo (inicio de mes va con cierre). */
export function kindEnabled(kind: AvisoKind, prefs: AvisoPrefs): boolean {
  switch (kind) {
    case 'due': return prefs.due_enabled;
    case 'cap': return prefs.cap_enabled;
    case 'month_end':
    case 'month_start': return prefs.month_close_enabled;
    case 'inactivity': return prefs.inactivity_enabled;
    case 'income': return prefs.income_enabled;
  }
}

export interface Aviso {
  kind: AvisoKind;
  title: string;
  body: string;
  /** Pantalla que abre al tocarlo (sw.js → notificationclick). */
  url: string;
  /** Para no repetir el mismo aviso (va en notification_log.payload.key). */
  key: string;
  tag: string;
}

/**
 * El aviso de hoy: el primero por prioridad entre los encendidos, o null si
 * ya recibió uno en las últimas 24 h.
 */
export function pickAviso(candidates: Aviso[], prefs: AvisoPrefs, log: LogEntry[], nowMs: number): Aviso | null {
  if (notifiedWithinDay(log, nowMs)) return null;
  const sentKeys = new Set(log.map((l) => l.payload?.key).filter(Boolean));
  const ok = candidates.filter((c) => kindEnabled(c.kind, prefs) && !sentKeys.has(c.key));
  ok.sort((a, b) => AVISO_PRIORITY.indexOf(a.kind) - AVISO_PRIORITY.indexOf(b.kind));
  return ok[0] ?? null;
}

// ── Copys ────────────────────────────────────────────

type Fmt = (n: number) => string;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dueCopy(name: string, amount: number, fmt: Fmt) {
  return { title: 'Pago por vencer', body: `Tu ${name} vence mañana: ${fmt(amount)}. ¿Ya lo apartaste?` };
}

export function capCopy(name: string, spent: number, cap: number, fmt: Fmt) {
  return { title: 'Te acercas a tu tope', body: `${name} va en ${fmt(spent)} de ${fmt(cap)} este mes.` };
}

export function inactivityCopy(days: number) {
  return { title: '¿Nos ponemos al día?', body: `Llevas ${days} días sin registrar. Agregar lo de la semana toma 1 minuto.` };
}

/** "{Mes} terminó · Ahorraste {Q}. Mira dónde podrías ahorrar {Q} más al mes." */
export function monthEndCopy(month: string, saved: number, potential: number, fmt: Fmt) {
  const title = `${capitalize(longMonth(month))} terminó`;
  if (saved > 0) {
    return {
      title,
      body: potential > 0
        ? `Ahorraste ${fmt(saved)}. Mira dónde podrías ahorrar ${fmt(potential)} más al mes.`
        : `Ahorraste ${fmt(saved)}. Mira cómo te fue.`,
    };
  }
  const over = Math.abs(saved);
  const lead = over > 0 ? `Gastaste ${fmt(over)} más de lo que recibiste.` : 'Gastaste lo mismo que recibiste.';
  return {
    title,
    body: potential > 0 ? `${lead} Mira dónde podrías ahorrar ${fmt(potential)} al mes.` : `${lead} Mira cómo te fue.`,
  };
}

export function incomeCopy(amount: number, source: string, month: string, fmt: Fmt) {
  return { title: 'Ingreso recibido', body: `${fmt(amount)} · ${source}. Ya está en tu plan de ${longMonth(month)}.` };
}

export function monthStartCopy(month: string) {
  const name = longMonth(month);
  return { title: `Empieza ${name} 🗓️`, body: `Empieza ${name}: confirma tu salario y aparta tus fijos.` };
}

/** Push de Apple Pay. Si ya llegó con categoría (regla del comercio), lo dice. */
export function applePayCopy(amount: number, merchant: string, fmt: Fmt, categoryName?: string | null) {
  return {
    title: 'Zafi',
    body: categoryName
      ? `Registramos ${fmt(amount)} en ${merchant} con Apple Pay: ${categoryName}. Toca si quieres cambiarla.`
      : `Registramos ${fmt(amount)} en ${merchant} con Apple Pay. Toca para elegir categoría.`,
  };
}

// ── Fechas (YYYY-MM-DD) ─────────────────────────────

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Día en que vence un fijo en `month` (si el mes es más corto, el último día). */
export function dueDateIn(month: string, expectedDay: number): string {
  const day = Math.min(expectedDay, daysInMonth(month));
  return `${month}-${String(day).padStart(2, '0')}`;
}

// ── Candidatos ───────────────────────────────────────

export interface AvisoTx extends CtfTx {
  created_at?: string | null;
}

export interface AvisoData {
  /** Hoy en Guatemala (YYYY-MM-DD). */
  today: string;
  nowMs: number;
  categories: CtfCategory[];
  subs: PlanSubItem[];
  incomes: PlanIncome[];
  /** Topes del hogar (lib/recomendaciones resolveCaps). */
  caps: Record<CapKey, number>;
  /** Movimientos del mes anterior y del actual. */
  txs: AvisoTx[];
  /** Fecha del último movimiento del hogar (cualquier mes). */
  lastTxDate: string | null;
  /** Último aviso de inactividad (ISO) o null. */
  lastInactivityAt: string | null;
  /** Inicio de mes del mes anterior con "Recordarme cada día 1" y sin hacer el de este mes. */
  monthStartPending: boolean;
}

/** Fijos (parte o categoría fija sin partes) que vencen mañana y siguen pendientes. */
export function dueCandidates(d: AvisoData, fmt: Fmt): Aviso[] {
  const tomorrow = addDays(d.today, 1);
  const month = tomorrow.slice(0, 7);
  const sameMonth = month === d.today.slice(0, 7);
  const spentByCategory: Record<string, number> = {};
  const spentBySub: Record<string, number> = {};
  if (sameMonth) {
    for (const t of d.txs) {
      if (t.type !== 'expense' || !t.date.startsWith(month)) continue;
      const amt = Number(t.amount) || 0;
      if (t.budget_sub_item_id) spentBySub[t.budget_sub_item_id] = (spentBySub[t.budget_sub_item_id] ?? 0) + amt;
      if (t.category_id) spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + amt;
    }
  }
  const active = d.categories.filter((c) => !c.archived_at);
  const subById = new Map(d.subs.map((s) => [s.id, s]));
  const catById = new Map(active.map((c) => [c.id, c]));
  const out: { aviso: Aviso; amount: number }[] = [];
  for (const leaf of planLeaves(active, d.subs)) {
    if (!leaf.fixed || !leaf.expectedDay || (leaf.bucket !== 'needs' && leaf.bucket !== 'wants')) continue;
    if (dueDateIn(month, leaf.expectedDay) !== tomorrow) continue;
    const sub = leaf.id !== leaf.categoryId ? subById.get(leaf.id) : undefined;
    const amount = sub ? Number(sub.amount) || 0 : leaf.plan;
    if (!(amount > 0)) continue;
    const spent = sub ? spentBySub[leaf.id] ?? 0 : spentByCategory[leaf.id] ?? 0;
    if (spent >= amount - 0.005) continue;
    const name = sub?.name ?? catById.get(leaf.categoryId)?.name ?? '';
    out.push({
      amount,
      aviso: { kind: 'due', ...dueCopy(name, amount, fmt), url: '/presupuesto', key: `due:${leaf.id}:${month}`, tag: 'zafi-due' },
    });
  }
  out.sort((a, b) => b.amount - a.amount);
  return out.map((o) => o.aviso);
}

/**
 * Topes del mes en curso que llegaron al 85 %. La base es el ingreso del
 * plan (o lo recibido si el plan no tiene ingresos): a mitad de mes lo
 * recibido puede ser solo la primera quincena.
 */
export function capCandidates(d: AvisoData, fmt: Fmt): Aviso[] {
  const month = d.today.slice(0, 7);
  const a = analyzeMonth(
    { categories: d.categories, subs: d.subs, incomes: d.incomes, txs: d.txs, snapshots: {}, earliest: month },
    month, d.caps, fmt,
  );
  const planned = planSummary(d.categories.filter((c) => !c.archived_at), d.subs, d.incomes).income;
  const base = planned > 0 ? planned : a.current.income;
  if (!(base > 0)) return [];
  const spentByKey: Partial<Record<CapKey, number>> = {};
  for (const s of Object.values(a.spend)) {
    const key = a.capKeyOf[s.id];
    if (key) spentByKey[key] = (spentByKey[key] ?? 0) + s.spent;
  }
  const out: { aviso: Aviso; ratio: number }[] = [];
  for (const [key, spent] of Object.entries(spentByKey) as [CapKey, number][]) {
    const capAmount = Math.round((d.caps[key] / 100) * base * 100) / 100;
    if (!(capAmount > 0)) continue;
    const ratio = spent / capAmount;
    if (ratio < CAP_WARN_RATIO) continue;
    out.push({
      ratio,
      aviso: {
        kind: 'cap', ...capCopy(CAP_META[key].name, spent, capAmount, fmt), url: `/resumen?mes=${month}`,
        key: `cap:${key}:${month}`, tag: 'zafi-cap',
      },
    });
  }
  out.sort((x, y) => y.ratio - x.ratio);
  return out.map((o) => o.aviso);
}

/** El día de "Cierre de mes": cuánto ahorró el mes pasado y cuánto más podría. */
export function monthEndCandidate(d: AvisoData, closeDay: number, fmt: Fmt): Aviso | null {
  const month = d.today.slice(0, 7);
  if (Number(d.today.slice(8, 10)) !== Math.min(closeDay, daysInMonth(month))) return null;
  const prev = addDays(`${month}-01`, -1).slice(0, 7);
  const prevTxs = d.txs.filter((t) => t.date.startsWith(prev));
  if (prevTxs.length === 0) return null;
  const a = analyzeMonth(
    { categories: d.categories, subs: d.subs, incomes: d.incomes, txs: prevTxs, snapshots: {}, earliest: prev },
    prev, d.caps, fmt,
  );
  if (!(a.current.income > 0)) return null;
  return {
    kind: 'month_end', ...monthEndCopy(prev, verdictSaved(a.current), a.recs.potential, fmt),
    url: `/resumen?mes=${prev}`, key: `month_end:${prev}`, tag: 'zafi-month-end',
  };
}

/** Día 1: "Empieza {mes}" a quien lo pidió en su último inicio de mes. */
export function monthStartCandidate(d: AvisoData): Aviso | null {
  if (!d.monthStartPending || d.today.slice(8, 10) !== '01') return null;
  const month = d.today.slice(0, 7);
  return {
    kind: 'month_start', ...monthStartCopy(month), url: '/dashboard?inicio_mes=1',
    key: `month_start:${month}`, tag: 'month-start',
  };
}

/** n días sin registrar (n ≥ umbral), como mucho una vez por semana. */
export function inactivityCandidate(d: AvisoData, thresholdDays: number): Aviso | null {
  if (!d.lastTxDate) return null;
  const days = daysBetween(d.lastTxDate.slice(0, 10), d.today);
  if (days < thresholdDays) return null;
  if (d.lastInactivityAt && d.nowMs - Date.parse(d.lastInactivityAt) < INACTIVITY_REPEAT_MS) return null;
  return {
    kind: 'inactivity', ...inactivityCopy(days), url: '/transacciones?action=manual',
    key: `inactivity:${d.today}`, tag: 'zafi-inactivity',
  };
}

/** Ingresos registrados en las últimas 24 h (el más reciente). */
export function incomeCandidates(d: AvisoData, fmt: Fmt): Aviso[] {
  const catName = new Map(d.categories.map((c) => [c.id, c.name]));
  return d.txs
    .filter((t) => t.type === 'income' && t.created_at && d.nowMs - Date.parse(t.created_at) < DAY_MS)
    .sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!))
    .map((t) => {
      const source = (t.description || '').trim() || (t.category_id ? catName.get(t.category_id) : '') || 'Ingreso';
      return {
        kind: 'income' as const, ...incomeCopy(Number(t.amount) || 0, source, t.date.slice(0, 7), fmt),
        url: '/presupuesto', key: `income:${t.id}`, tag: 'zafi-income',
      };
    });
}

/** Todos los avisos posibles hoy (sin filtrar por preferencias ni límite). */
export function buildCandidates(d: AvisoData, prefs: AvisoPrefs, fmt: Fmt): Aviso[] {
  const out: Aviso[] = [];
  if (prefs.due_enabled) out.push(...dueCandidates(d, fmt));
  if (prefs.cap_enabled) out.push(...capCandidates(d, fmt));
  if (prefs.month_close_enabled) {
    const end = monthEndCandidate(d, prefs.month_close_day, fmt);
    if (end) out.push(end);
    const start = monthStartCandidate(d);
    if (start) out.push(start);
  }
  if (prefs.inactivity_enabled) {
    const ina = inactivityCandidate(d, prefs.inactivity_threshold_days);
    if (ina) out.push(ina);
  }
  if (prefs.income_enabled) out.push(...incomeCandidates(d, fmt));
  return out;
}
