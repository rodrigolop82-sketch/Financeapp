// Datos de "Cómo te fue" (/resumen): totales por mes, gasto por tope,
// lo que salió bien / lo que se pasó y las gráficas de 6 meses. Puro (sin
// React ni Supabase) para probarlo con vitest.
//
// Convenciones (las mismas de Plan del mes, regla 50/30/20):
// - "Gastaste" = gastos de Lo básico (needs) + Gustos (wants) + sin categoría.
// - Lo que va a Ahorro y deudas (savings) no es gasto: es parte de lo que ahorras.
// - "Ingresos recibidos" = movimientos type='income' del mes.
// - "Ahorraste" = ingresos recibidos − gastaste.

import { categoryPlan, subMonthly, type PlanCategory, type PlanSubItem } from './plan-del-mes';
import {
  CAP_KEYS, type CapGroupInput, type CapKey, type CapOk, type PlanItem,
} from './recomendaciones';

export interface CtfCategory extends PlanCategory {
  icon?: string | null;
  parent_category_id?: string | null;
  cap_key?: string | null;
  archived_at?: string | null;
}

export interface CtfTx {
  id: string;
  category_id: string | null;
  budget_sub_item_id?: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  date: string;
  description?: string | null;
}

const SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'Sep' para '2026-09'. */
export function shortMonth(month: string): string {
  return SHORT[Number(month.split('-')[1]) - 1] ?? '';
}

/** 'septiembre' para '2026-09'. */
export function longMonth(month: string): string {
  return LONG[Number(month.split('-')[1]) - 1] ?? '';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Fijo / variable ──────────────────────────────────

/**
 * ¿Un gasto es fijo? Usa el `is_fixed` de su parte (Fase 5); si no tiene
 * parte, el de la categoría: fija si todas sus partes son fijas o, sin
 * partes, si su `pace_mode` es 'fixed'.
 */
export function fixedResolver(categories: CtfCategory[], subs: PlanSubItem[]) {
  const subFixed = new Map(subs.map((s) => [s.id, !!s.is_fixed]));
  const catFixed = new Map<string, boolean>();
  for (const c of categories) {
    const own = subs.filter((s) => s.category_id === c.id);
    catFixed.set(c.id, own.length > 0 ? own.every((s) => s.is_fixed) : c.pace_mode === 'fixed');
  }
  return {
    category: (id: string | null) => (id ? catFixed.get(id) ?? false : false),
    tx: (t: Pick<CtfTx, 'category_id' | 'budget_sub_item_id'>) => {
      if (t.budget_sub_item_id && subFixed.has(t.budget_sub_item_id)) return subFixed.get(t.budget_sub_item_id)!;
      return t.category_id ? catFixed.get(t.category_id) ?? false : false;
    },
  };
}

// ── Totales por mes ──────────────────────────────────

export interface MonthTotals {
  month: string;
  income: number;
  needs: number;
  wants: number;
  /** Lo que se fue a Ahorro y deudas (no cuenta como gasto). */
  savingsBucket: number;
  /** needs + wants (+ sin categoría). */
  spent: number;
  fixed: number;
  variable: number;
  /** income − spent. */
  saved: number;
  /** El mes tiene algún movimiento. */
  hasData: boolean;
}

export function monthTotals(
  txs: CtfTx[],
  months: string[],
  categories: CtfCategory[],
  isFixedTx: (t: CtfTx) => boolean,
): MonthTotals[] {
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket]));
  return months.map((month) => {
    const t: MonthTotals = { month, income: 0, needs: 0, wants: 0, savingsBucket: 0, spent: 0, fixed: 0, variable: 0, saved: 0, hasData: false };
    for (const tx of txs) {
      if (!tx.date.startsWith(month)) continue;
      t.hasData = true;
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') { t.income += amt; continue; }
      const bucket = tx.category_id ? bucketOf.get(tx.category_id) ?? 'needs' : 'needs';
      if (bucket === 'savings') { t.savingsBucket += amt; continue; }
      if (bucket === 'income') continue;
      if (bucket === 'wants') t.wants += amt; else t.needs += amt;
      if (isFixedTx(tx)) t.fixed += amt; else t.variable += amt;
    }
    t.income = round2(t.income);
    t.needs = round2(t.needs);
    t.wants = round2(t.wants);
    t.savingsBucket = round2(t.savingsBucket);
    t.fixed = round2(t.fixed);
    t.variable = round2(t.variable);
    t.spent = round2(t.needs + t.wants);
    t.saved = round2(t.income - t.spent);
    return t;
  });
}

/** Redondea porcentajes para que sumen 100 (mayor residuo). */
export function roundShares(values: number[]): number[] {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0);
  if (!(total > 0)) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v) / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, v) => a + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; floor[i] += 1; left -= 1; }
  return floor;
}

/**
 * Reparto de los ingresos del mes en Necesidades / Gustos / Ahorro (lo que
 * quedó). Si gastaste más de lo que recibiste, el ahorro es 0 y la base es
 * el gasto. null si el mes no tiene ni ingresos ni gastos.
 */
export function bucketShares(t: MonthTotals): { needs: number; wants: number; savings: number } | null {
  const savings = Math.max(0, t.income - t.spent);
  if (!(t.needs + t.wants + savings > 0)) return null;
  const [needs, wants, sav] = roundShares([t.needs, t.wants, savings]);
  return { needs, wants, savings: sav };
}

/** % de ahorro del mes sobre los ingresos (null sin ingresos). */
export function savingsPct(t: MonthTotals): number | null {
  if (!(t.income > 0)) return null;
  return Math.round((t.saved / t.income) * 100);
}

/** Fijos / variables en % del gasto del mes. */
export function fixedVarShares(t: MonthTotals): { fixed: number; variable: number } | null {
  if (!(t.spent > 0)) return null;
  const [fixed, variable] = roundShares([t.fixed, t.variable]);
  return { fixed, variable };
}

/** Meses de la gráfica: hasta 6 terminando en `month`, desde el primero con datos. */
export function chartMonths(month: string, earliest: string | null, n = 6): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(month, -i);
    if (!earliest || m >= earliest || m === month) out.push(m);
  }
  return out;
}

/** Subtítulo de "¿A dónde se va tu dinero?". */
export function bucketsInsight(series: MonthTotals[]): string {
  const withIncome = series.filter((t) => t.income > 0);
  const last = series[series.length - 1];
  const lastPct = last ? savingsPct(last) : null;
  if (withIncome.length < 2 || lastPct === null) return 'Así se repartieron tus ingresos este mes. Lo sano: 50% necesidades, 30% gustos y 20% ahorro.';
  const first = withIncome[0];
  const firstPct = savingsPct(first)!;
  const n = series.length - series.indexOf(first);
  const fmtPct = (p: number) => `${Math.max(0, p)}%`;
  const wantsShare = (t: MonthTotals) => (t.income > 0 ? Math.round((t.wants / t.income) * 100) : 0);
  if (lastPct <= firstPct - 2) {
    const wantsUp = wantsShare(last) >= wantsShare(first) + 2;
    return `Tu ahorro bajó de ${fmtPct(firstPct)} a ${fmtPct(lastPct)} en ${n} meses${wantsUp ? ', mientras los gustos subieron' : ''}.`;
  }
  if (lastPct >= firstPct + 2) return `Tu ahorro subió de ${fmtPct(firstPct)} a ${fmtPct(lastPct)} en ${n} meses. Vas por buen camino.`;
  return `Tu ahorro se ha mantenido cerca de ${fmtPct(lastPct)} en ${n} meses.`;
}

/** Subtítulo de "Fijos vs variables". */
export function fixedVarInsight(series: MonthTotals[], fmt: (n: number) => string): string {
  const tail = 'Son los más fáciles de bajar; los fijos piden cambiar contratos, deudas o servicios.';
  const withSpend = series.filter((t) => t.spent > 0);
  const last = series[series.length - 1];
  if (withSpend.length < 2 || !last || !(last.spent > 0)) return `Los variables cambian según lo que hagas. ${tail}`;
  const first = withSpend[0];
  const diff = last.variable - first.variable;
  const since = longMonth(first.month);
  if (diff >= 100) return `Los variables subieron ${fmt(diff)} desde ${since}. ${tail}`;
  if (diff <= -100) return `Los variables bajaron ${fmt(-diff)} desde ${since}. ${tail}`;
  return `Tus variables se han mantenido estables desde ${since}. ${tail}`;
}

// ── Gasto por categoría y por tope ───────────────────

export interface CategorySpend {
  id: string;
  name: string;
  bucket: string;
  spent: number;
  fixedSpent: number;
  /** Gasto por parte (budget_sub_item_id) o '' si no tiene. */
  bySub: Record<string, number>;
}

/** Gasto del mes por categoría (solo Lo básico y Gustos). */
export function spendByCategory(
  txs: CtfTx[],
  month: string,
  categories: CtfCategory[],
  isFixedTx: (t: CtfTx) => boolean,
): Record<string, CategorySpend> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: Record<string, CategorySpend> = {};
  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.date.startsWith(month) || !tx.category_id) continue;
    const c = byId.get(tx.category_id);
    if (!c || (c.bucket !== 'needs' && c.bucket !== 'wants')) continue;
    const row = out[c.id] ??= { id: c.id, name: c.name, bucket: c.bucket, spent: 0, fixedSpent: 0, bySub: {} };
    const amt = Number(tx.amount) || 0;
    row.spent = round2(row.spent + amt);
    if (isFixedTx(tx)) row.fixedSpent = round2(row.fixedSpent + amt);
    const sk = tx.budget_sub_item_id ?? '';
    row.bySub[sk] = round2((row.bySub[sk] ?? 0) + amt);
  }
  return out;
}

/** Agrupa el gasto por tope; `topSub` es la categoría o parte con más gasto. */
export function capGroups(
  spend: Record<string, CategorySpend>,
  capKeyOf: Record<string, CapKey | null>,
  subs: PlanSubItem[],
  planFixedOf: (categoryId: string) => boolean,
  categories: CtfCategory[],
): CapGroupInput[] {
  const subName = new Map(subs.map((s) => [s.id, s.name]));
  const groups: CapGroupInput[] = [];
  for (const key of CAP_KEYS) {
    const cats = categories.filter((c) => capKeyOf[c.id] === key);
    if (cats.length === 0) continue;
    let spent = 0;
    let fixedSpent = 0;
    let topSub: { name: string; amount: number } | null = null;
    for (const c of cats) {
      const s = spend[c.id];
      if (!s) continue;
      spent += s.spent;
      fixedSpent += s.fixedSpent;
      // Subcategoría: la parte si el gasto tiene parte; si no, la categoría.
      for (const [sk, amount] of Object.entries(s.bySub)) {
        const name = (sk && subName.get(sk)) || c.name;
        if (!topSub || amount > topSub.amount) topSub = { name, amount };
      }
    }
    groups.push({
      key, spent: round2(spent), fixedSpent: round2(fixedSpent), topSub,
      planFixed: cats.every((c) => planFixedOf(c.id)),
    });
  }
  return groups;
}

/** Partidas del plan vigente (Lo básico y Gustos) con su tope. */
export function planItems(
  categories: CtfCategory[],
  subs: PlanSubItem[],
  capKeyOf: Record<string, CapKey | null>,
): PlanItem[] {
  return categories
    .filter((c) => (c.bucket === 'needs' || c.bucket === 'wants') && !c.archived_at)
    .map((c) => ({
      categoryId: c.id,
      key: capKeyOf[c.id] ?? null,
      plan: round2(categoryPlan(c, subs)),
      parts: subs.filter((s) => s.category_id === c.id).map((s) => ({ id: s.id, monthly: round2(subMonthly(s)) })),
    }));
}

// ── Lo que salió bien / Lo que se pasó ───────────────

export interface CategoryHistory {
  id: string;
  name: string;
  spent: number;
  /** Mes anterior (null si ese mes no tiene datos). */
  prev: number | null;
  /** Promedio de los 3 meses anteriores con datos (null si no hay). */
  avg3: number | null;
  /** Plan de la categoría para el mes. */
  plan: number;
}

export interface HighlightsInput {
  categories: CategoryHistory[];
  okCaps: CapOk[];
  /** % de ahorro del mes y de un mes anterior para comparar. */
  savingsNow: number | null;
  savingsThen: { month: string; pct: number } | null;
  prevMonth: string;
  fmt: (n: number) => string;
}

const MAX_ITEMS = 3;

/** Toma uno de cada lista por turnos hasta `max`. */
function interleave(lists: string[][], max: number): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < max && lists.some((l) => l.length > i); i++) {
    for (const l of lists) if (l[i] && out.length < max) out.push(l[i]);
  }
  return out;
}

export function monthHighlights({ categories, okCaps, savingsNow, savingsThen, prevMonth, fmt }: HighlightsInput): { good: string[]; bad: string[] } {
  // Bien: topes respetados y bajas contra el mes anterior.
  const capsOk = okCaps.map((c) => `${c.name}: ${Math.round(c.pct)}% de tus ingresos, bajo tu tope de ${c.cap}%.`);
  const drops = categories
    .filter((c) => c.prev !== null && c.prev > 0 && c.prev - c.spent >= Math.max(100, c.prev * 0.1))
    .sort((a, b) => (b.prev! - b.spent) - (a.prev! - a.spent))
    .map((c) => `Gastaste ${fmt(c.prev! - c.spent)} menos en ${c.name.toLowerCase()} que en ${longMonth(prevMonth)}.`);
  const healthy = savingsNow !== null && savingsNow >= 20 ? [`Ahorraste el ${savingsNow}% de tus ingresos: lo sano es 20% o más.`] : [];

  // Mal: subidas contra el promedio, categorías sobre plan y caída del ahorro.
  const rises = categories
    .filter((c) => c.avg3 !== null && c.avg3 > 0 && c.spent - c.avg3 >= Math.max(150, c.avg3 * 0.15))
    .sort((a, b) => (b.spent - b.avg3!) - (a.spent - a.avg3!));
  const risen = new Set(rises.map((c) => c.id));
  const overPlan = categories
    .filter((c) => c.plan > 0 && c.spent - c.plan >= 1 && !risen.has(c.id))
    .sort((a, b) => (b.spent - b.plan) - (a.spent - a.plan))
    .map((c) => `${c.name} se pasó de su plan por ${fmt(c.spent - c.plan)}.`);
  const savingsDrop = savingsNow !== null && savingsThen && savingsThen.pct - savingsNow >= 2
    ? [`Tu ahorro bajó a ${Math.max(0, savingsNow)}%; en ${longMonth(savingsThen.month)} era ${savingsThen.pct}%.`]
    : [];

  return {
    good: interleave([capsOk, drops, healthy], MAX_ITEMS),
    bad: interleave([
      rises.map((c) => `${c.name}: ${fmt(c.spent)}, ${fmt(c.spent - c.avg3!)} más que tu promedio.`),
      overPlan,
      savingsDrop,
    ], MAX_ITEMS),
  };
}

/** Promedio de los meses con datos (null si ninguno). */
export function averageOf(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? round2(v.reduce((a, x) => a + x, 0) / v.length) : null;
}

// ── Detalle por categoría ────────────────────────────

export interface CategoryStatus {
  text: string;
  tone: 'warning' | 'ok';
}

/** "Pasa tope 30%", "+Q 350 vs plan" o "En línea". */
export function categoryStatus(
  opts: { capOver: boolean; cap: number | null; spent: number; plan: number },
  fmt: (n: number) => string,
): CategoryStatus {
  if (opts.capOver && opts.cap !== null) return { text: `Pasa tope ${opts.cap}%`, tone: 'warning' };
  if (opts.plan > 0 && opts.spent - opts.plan >= 1) return { text: `+${fmt(opts.spent - opts.plan)} vs plan`, tone: 'warning' };
  return { text: 'En línea', tone: 'ok' };
}

/** "+Q 350", "−Q 120" o "Igual" (lo gastado contra el plan). */
export function vsPlanText(spent: number, plan: number, fmt: (n: number) => string): { text: string; over: boolean } {
  const d = round2(spent - plan);
  if (d >= 1) return { text: `+${fmt(d)}`, over: true };
  if (d <= -1) return { text: `−${fmt(-d)}`, over: false };
  return { text: 'Igual', over: false };
}

export interface MerchantGroup {
  name: string;
  total: number;
  count: number;
}

/** Comercios de una lista de movimientos, de mayor a menor gasto. */
export function merchantGroups(
  txs: { description?: string | null; amount: number | string }[],
  nameOf: (description: string) => string,
): MerchantGroup[] {
  const map = new Map<string, MerchantGroup>();
  for (const t of txs) {
    const name = nameOf(t.description ?? '') || 'Sin nombre';
    const key = name.toLowerCase();
    const g = map.get(key) ?? { name, total: 0, count: 0 };
    g.total = round2(g.total + (Number(t.amount) || 0));
    g.count += 1;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/** "1 vez" / "3 veces". */
export function timesText(n: number): string {
  return n === 1 ? '1 vez' : `${n} veces`;
}
