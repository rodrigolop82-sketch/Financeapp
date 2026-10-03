// Cálculos puros de la pantalla "Plan del mes" (/presupuesto): totales de la
// tarjeta resumen, sub-líneas de cada fila, impacto en vivo de la hoja de
// edición y la parte sugerida al registrar un movimiento. Sin React ni
// Supabase para poder probarlo con vitest.

export type Bucket = 'needs' | 'wants' | 'savings' | 'income';

export interface PlanCategory {
  id: string;
  name: string;
  bucket: Bucket;
  budgeted_amount: number | string;
  pace_mode?: 'linear' | 'fixed' | null;
  expected_day?: number | null;
}

export interface PlanSubItem {
  id: string;
  category_id: string;
  name: string;
  amount: number | string;
  is_fixed: boolean;
  recurrence?: string | null;
  expected_day?: number | null;
}

export interface PlanIncome {
  id: string;
  source: string;
  amount: number | string;
  frequency: string;
  is_fixed?: boolean | null;
  expected_day?: number | null;
  category_id?: string | null;
}

/** Veces que un ingreso de esa frecuencia llega en un mes. */
export const FREQUENCY_MULTIPLIER: Record<string, number> = {
  mensual: 1,
  quincenal: 2,
  semanal: 4.33,
  anual: 1 / 12,
};

/** Meses que cubre el monto de una parte según su recurrencia. */
const RECURRENCE_MONTHS: Record<string, number> = {
  trimestral: 3,
  anual: 12,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Monto mensual de un ingreso. */
export function incomeMonthly(e: Pick<PlanIncome, 'amount' | 'frequency'>): number {
  return Number(e.amount) * (FREQUENCY_MULTIPLIER[e.frequency] ?? 1);
}

/** Monto que se guarda en la fila para que su equivalente mensual sea `monthly`. */
export function incomeAmountFromMonthly(monthly: number, frequency: string): number {
  return round2(monthly / (FREQUENCY_MULTIPLIER[frequency] ?? 1));
}

/** Monto mensual de una parte (respeta `recurrence`). */
export function subMonthly(s: Pick<PlanSubItem, 'amount' | 'recurrence'>): number {
  return Number(s.amount) / (RECURRENCE_MONTHS[s.recurrence ?? 'mensual'] ?? 1);
}

/** Monto que se guarda en la parte para que su equivalente mensual sea `monthly`. */
export function subAmountFromMonthly(monthly: number, recurrence: string | null | undefined): number {
  return round2(monthly * (RECURRENCE_MONTHS[recurrence ?? 'mensual'] ?? 1));
}

/** Plan mensual de una categoría: la suma de sus partes o su `budgeted_amount`. */
export function categoryPlan(cat: PlanCategory, subs: PlanSubItem[]): number {
  const own = subs.filter((s) => s.category_id === cat.id);
  if (own.length > 0) return own.reduce((a, s) => a + subMonthly(s), 0);
  return Number(cat.budgeted_amount) || 0;
}

export interface Leaf {
  /** Id de la parte, o de la categoría si no tiene partes. */
  id: string;
  categoryId: string;
  bucket: Bucket;
  plan: number;
  fixed: boolean;
  expectedDay: number | null;
}

/**
 * Hojas del plan: cada parte, o la categoría si no tiene partes. Cuando una
 * categoría tiene partes, su `pace_mode` se ignora y cada parte decide.
 */
export function planLeaves(categories: PlanCategory[], subs: PlanSubItem[]): Leaf[] {
  const leaves: Leaf[] = [];
  for (const c of categories) {
    if (c.bucket === 'income') continue;
    const own = subs.filter((s) => s.category_id === c.id);
    if (own.length === 0) {
      leaves.push({
        id: c.id, categoryId: c.id, bucket: c.bucket, plan: Number(c.budgeted_amount) || 0,
        fixed: c.pace_mode === 'fixed', expectedDay: c.expected_day ?? null,
      });
      continue;
    }
    for (const s of own) {
      leaves.push({
        id: s.id, categoryId: c.id, bucket: c.bucket, plan: subMonthly(s),
        fixed: !!s.is_fixed, expectedDay: s.expected_day ?? null,
      });
    }
  }
  return leaves;
}

export interface PlanSummary {
  income: number;
  needs: number;
  wants: number;
  savings: number;
  assigned: number;
  /** ingresos − (básico + gustos + metas). */
  unassigned: number;
  /** Hojas fijas de básico + gustos. */
  fixed: number;
  /** Hojas variables de básico + gustos. */
  variable: number;
}

export function planSummary(categories: PlanCategory[], subs: PlanSubItem[], incomes: PlanIncome[]): PlanSummary {
  const income = round2(incomes.reduce((a, e) => a + incomeMonthly(e), 0));
  const leaves = planLeaves(categories, subs);
  const sum = (pred: (l: Leaf) => boolean) => round2(leaves.filter(pred).reduce((a, l) => a + l.plan, 0));
  const needs = sum((l) => l.bucket === 'needs');
  const wants = sum((l) => l.bucket === 'wants');
  const savings = sum((l) => l.bucket === 'savings');
  const assigned = round2(needs + wants + savings);
  const spendable = (l: Leaf) => l.bucket === 'needs' || l.bucket === 'wants';
  return {
    income, needs, wants, savings, assigned,
    unassigned: round2(income - assigned),
    fixed: sum((l) => spendable(l) && l.fixed),
    variable: sum((l) => spendable(l) && !l.fixed),
  };
}

/** Ancho (0–100) de cada segmento de la barra apilada. */
export function stackedWidths(s: Pick<PlanSummary, 'income' | 'needs' | 'wants' | 'savings' | 'assigned'>) {
  const base = Math.max(s.income, s.assigned);
  const pct = (v: number) => (base > 0 ? (v / base) * 100 : 0);
  return { needs: pct(s.needs), wants: pct(s.wants), savings: pct(s.savings) };
}

export function unassignedCopy(unassigned: number): { label: string; hint: string } {
  if (unassigned > 0) return { label: 'Sin asignar', hint: 'Dale un destino antes de que se vaya en gastos sueltos.' };
  if (unassigned === 0) return { label: 'Todo tiene a dónde ir', hint: 'Cada quetzal que te entra ya tiene un trabajo.' };
  return { label: 'Planeaste de más', hint: 'Tu plan pide más de lo que te entra. Baja alguna categoría.' };
}

export type Tone = 'muted' | 'danger' | 'warning';
export type BarTone = 'normal' | 'warning' | 'danger' | 'income';

export interface RowStatus {
  text: string;
  tone: Tone;
  /** Avance de la barra, 0–100. */
  pct: number;
  bar: BarTone;
}

/** Umbral desde el que un gasto variable se pinta en ámbar. */
export const WARN_RATIO = 0.85;

/** Sub-línea y barra de una categoría o parte de gastos (en orden de prioridad). */
export function expenseStatus(
  plan: number,
  spent: number,
  fixed: boolean,
  fmt: (n: number) => string,
): RowStatus {
  const r = plan > 0 ? spent / plan : spent > 0 ? 2 : 0;
  const pct = Math.min(100, Math.round(r * 100));
  const bar: BarTone = r > 1 ? 'danger' : r >= WARN_RATIO && !fixed ? 'warning' : 'normal';
  let text: string;
  let tone: Tone = 'muted';
  if (spent > plan) { text = `${fmt(spent - plan)} de más`; tone = 'danger'; }
  else if (fixed && spent > 0 && spent >= plan) text = 'Pagado ✓';
  // "Apartado Q x · vence el {día}" llega con el inicio de mes (Fase 6).
  else if (fixed && spent > 0) text = `Pagado ${fmt(spent)} · faltan ${fmt(plan - spent)}`;
  else if (fixed) text = 'Falta pagar';
  else if (!spent) text = 'Nada gastado todavía';
  else {
    text = `Llevas ${fmt(spent)} · quedan ${fmt(plan - spent)}`;
    if (r >= WARN_RATIO) tone = 'warning';
  }
  return { text, tone, pct, bar };
}

/** Sub-línea y barra (verde, recibido / esperado) de un ingreso. */
export function incomeStatus(
  amount: number,
  received: number,
  fixed: boolean,
  day: number | null,
  fmt: (n: number) => string,
): RowStatus {
  const pct = Math.min(100, Math.round((received / (amount || 1)) * 100));
  let text: string;
  if (!fixed) text = `Estimado · llevas ${fmt(received)}`;
  else if (amount > 0 && received >= amount) text = 'Recibido ✓';
  else if (received > 0) text = `Recibido ${fmt(received)} · faltan ${fmt(amount - received)}`;
  else text = day ? `Llega el día ${day}` : 'Sin fecha fija';
  return { text, tone: 'muted', pct, bar: 'income' };
}

/**
 * Reparte lo recibido por categoría entre los ingresos que la comparten
 * (p. ej. "1ra quincena" y "2da quincena" en Salario): llena cada uno en
 * orden hasta su monto y el sobrante va al último.
 */
export function allocateReceived(
  incomes: (Pick<PlanIncome, 'id' | 'amount' | 'frequency'> & { categoryId: string | null })[],
  receivedByCategory: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const left: Record<string, number> = { ...receivedByCategory };
  const lastOf: Record<string, string> = {};
  for (const e of incomes) if (e.categoryId) lastOf[e.categoryId] = e.id;
  for (const e of incomes) {
    if (!e.categoryId) { out[e.id] = 0; continue; }
    const avail = left[e.categoryId] ?? 0;
    const take = lastOf[e.categoryId] === e.id ? avail : Math.min(avail, incomeMonthly(e));
    out[e.id] = round2(take);
    left[e.categoryId] = round2(avail - take);
  }
  return out;
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Categoría de ingreso con la que se registra un ingreso del plan: la que
 * se llame como él, si no "Salario" para los fijos y "Otros ingresos" para
 * los variables, y si no la primera.
 */
export function inferIncomeCategory<T extends { id: string; name: string }>(
  name: string,
  isFixed: boolean,
  incomeCategories: T[],
): T | null {
  if (incomeCategories.length === 0) return null;
  const n = norm(name);
  const byName = incomeCategories.find((c) => {
    const cn = norm(c.name);
    return cn.length > 2 && (n.includes(cn) || (n.length > 2 && cn.includes(n.split(' ')[0])));
  });
  if (byName) return byName;
  const fallback = isFixed ? 'salario' : 'otros ingresos';
  return incomeCategories.find((c) => norm(c.name) === fallback) ?? incomeCategories[0];
}

/** Palabras del texto libre → texto que debe contener el nombre de la parte. */
const SUB_KEYWORDS: { words: string[]; targets: string[] }[] = [
  { words: ['cuota', 'mantenimiento'], targets: ['mantenimiento'] },
  { words: ['renta', 'alquiler', 'hipoteca'], targets: ['renta', 'hipoteca'] },
];

/** Parte sugerida para un texto libre ("cuota mantenimiento 200"), o null si hay que preguntar. */
export function suggestSubItem<T extends { id: string; name: string }>(text: string, subs: T[]): T | null {
  const words = norm(text).split(/[^a-z0-9ñ]+/).filter(Boolean);
  for (const rule of SUB_KEYWORDS) {
    if (!rule.words.some((w) => words.includes(w))) continue;
    const hit = subs.find((s) => rule.targets.some((t) => norm(s.name).includes(t)));
    if (hit) return hit;
  }
  return null;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "octubre" para '2026-10'. */
export function monthName(month: string): string {
  return MONTHS[Number(month.split('-')[1]) - 1] ?? '';
}

/** '2026-09' para '2026-10'. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Texto de la caja de impacto de la hoja "Editar plan". */
export function impactText(newUnassigned: number, isIncome: boolean, fmt: (n: number) => string): string {
  if (newUnassigned > 0) return `Te quedarían ${fmt(newUnassigned)} sin asignar`;
  if (newUnassigned === 0) return 'Todo tu dinero queda asignado';
  return isIncome
    ? `Tu plan pediría ${fmt(-newUnassigned)} más de lo que te entra`
    : `Te pasarías ${fmt(-newUnassigned)} de lo que te entra`;
}
