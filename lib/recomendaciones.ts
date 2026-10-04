// Motor de recomendaciones de "Cómo te fue": topes por % de ingreso,
// oportunidades para ahorrar, alertas del plan y proyección. Puro (sin
// React ni Supabase) para probarlo con vitest.

export type CapKey = 'vivienda' | 'carro' | 'comida' | 'gustos' | 'deudas' | 'suscripciones';

export const CAP_KEYS: CapKey[] = ['vivienda', 'carro', 'comida', 'gustos', 'deudas', 'suscripciones'];

/** Topes recomendados (% de los ingresos recibidos) si el hogar no ha elegido otro. */
export const DEFAULT_CAPS: Record<CapKey, number> = {
  vivienda: 30,
  carro: 15,
  comida: 15,
  gustos: 10,
  deudas: 20,
  suscripciones: 5,
};

/** Rango del slider de la hoja "Tope para {categoría}". */
export const CAP_MIN = 3;
export const CAP_MAX = 50;

export const CAP_META: Record<CapKey, { name: string; emoji: string }> = {
  vivienda: { name: 'Vivienda', emoji: '🏠' },
  carro: { name: 'Carro', emoji: '🚗' },
  comida: { name: 'Alimentación', emoji: '🍽️' },
  gustos: { name: 'Gustos', emoji: '🎉' },
  deudas: { name: 'Deudas', emoji: '💳' },
  suscripciones: { name: 'Suscripciones', emoji: '📺' },
};

export function isCapKey(v: unknown): v is CapKey {
  return typeof v === 'string' && (CAP_KEYS as string[]).includes(v);
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Reglas por nombre, en orden (la primera gana). Son las mismas que usa la
 * migración 20261009_spending_caps.sql para llenar `budget_categories.cap_key`.
 */
const CAP_RULES: [CapKey, RegExp][] = [
  ['suscripciones', /suscrip|streaming|netflix|spotify|gimnasio|membres/],
  ['deudas', /deuda|prestamo|tarjeta|credito/],
  ['vivienda', /vivienda|alquiler|(^|[^a-z])(renta|casa)|hipoteca|apartamento/],
  ['carro', /carro|(^|[^a-z])(auto|moto)|vehicul|transporte|gasolina|combustible|parqueo/],
  ['comida', /aliment|comida|(^|[^a-z])(super|cafe)|mercado|restaurant|despensa/],
  ['gustos', /entreten|salida|ropa|varios personales|diversion|ocio|viaje|compras|hobby|gusto/],
];

/** Tope que le toca a una categoría de gasto por su nombre (null si ninguno). */
export function inferCapKey(name: string, bucket: string): CapKey | null {
  if (bucket !== 'needs' && bucket !== 'wants') return null;
  const n = norm(name);
  for (const [key, re] of CAP_RULES) if (re.test(n)) return key;
  return null;
}

export interface CapCategory {
  id: string;
  name: string;
  bucket: string;
  cap_key?: string | null;
  parent_category_id?: string | null;
}

/**
 * Tope de cada categoría: el `cap_key` guardado; si no tiene, el de su
 * categoría padre; si tampoco, el que sale de su nombre. Solo gastos
 * (Lo básico y Gustos): Ahorro y deudas e ingresos no llevan tope.
 */
export function categoryCapKeys(categories: CapCategory[]): Record<string, CapKey | null> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const own = (c: CapCategory): CapKey | null => {
    if (c.bucket !== 'needs' && c.bucket !== 'wants') return null;
    if (isCapKey(c.cap_key)) return c.cap_key;
    return null;
  };
  const out: Record<string, CapKey | null> = {};
  for (const c of categories) {
    if (c.bucket !== 'needs' && c.bucket !== 'wants') { out[c.id] = null; continue; }
    const parent = c.parent_category_id ? byId.get(c.parent_category_id) : undefined;
    out[c.id] = own(c)
      ?? (parent ? own(parent) ?? inferCapKey(parent.name, parent.bucket) : null)
      ?? inferCapKey(c.name, c.bucket);
  }
  return out;
}

/** Topes del hogar: las filas de `spending_caps` sobre los recomendados. */
export function resolveCaps(rows: { cap_key: string; pct: number | string }[] | null | undefined): Record<CapKey, number> {
  const caps = { ...DEFAULT_CAPS };
  for (const r of rows ?? []) {
    const pct = Number(r.pct);
    if (isCapKey(r.cap_key) && pct > 0) caps[r.cap_key] = pct;
  }
  return caps;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ExpenseKind = 'fijo' | 'variable';

/** Gasto del mes de un tope (todas sus categorías). */
export interface CapGroupInput {
  key: CapKey;
  spent: number;
  /** Lo que de `spent` es fijo (según `is_fixed` / `pace_mode` del plan). */
  fixedSpent: number;
  /** Sin gasto, el tipo sale del plan. */
  planFixed?: boolean;
  /** Subcategoría (categoría o parte) con más gasto. */
  topSub?: { name: string; amount: number } | null;
}

export interface Recommendation {
  key: CapKey;
  name: string;
  emoji: string;
  spent: number;
  /** % de los ingresos (sin redondear). */
  pct: number;
  cap: number;
  /** Tope en dinero: cap × ingresos. */
  capAmount: number;
  /** Lo que se libera al mes si baja al tope. */
  saving: number;
  kind: ExpenseKind;
  advice: string;
}

export interface CapOk {
  key: CapKey;
  name: string;
  emoji: string;
  spent: number;
  pct: number;
  cap: number;
}

export interface RecommendationResult {
  /** Sobre su tope: variables primero y, dentro, por ahorro de mayor a menor. */
  over: Recommendation[];
  /** Dentro de su tope. */
  ok: CapOk[];
  /** Suma de lo que se podría liberar al mes. */
  potential: number;
}

/** Fijo si la mitad o más del gasto es fijo; sin gasto, según el plan. */
export function groupKind(g: Pick<CapGroupInput, 'spent' | 'fixedSpent' | 'planFixed'>): ExpenseKind {
  if (g.spent > 0) return g.fixedSpent * 2 >= g.spent ? 'fijo' : 'variable';
  return g.planFixed ? 'fijo' : 'variable';
}

const RESTAURANT = /restaur|comida rapida|salida|pedido|delivery|cafe/;

/** Gasto semanal redondeado a Q 50. */
function weekly(monthly: number): number {
  return Math.max(50, Math.round(monthly / 4.33 / 50) * 50);
}

/** Consejo concreto por tope, con el dato real del mes. */
export function adviceFor(
  key: CapKey,
  ctx: { saving: number; capAmount: number; variableSpent: number; topSub?: { name: string; amount: number } | null },
  fmt: (n: number) => string,
): string {
  const top = ctx.topSub && ctx.topSub.amount > 0 ? ctx.topSub : null;
  switch (key) {
    case 'comida': {
      if (top && RESTAURANT.test(norm(top.name))) {
        const tail = top.amount >= ctx.saving ? 'cubre casi todo' : 'te acerca a tu tope';
        return `${top.name} fue ${fmt(top.amount)}. Cocinar 2 veces más por semana ${tail}.`;
      }
      const lead = top ? `${top.name} fue ${fmt(top.amount)}. ` : '';
      return `${lead}Haz una lista antes de ir al súper y compra por semana, no por antojo.`;
    }
    case 'gustos':
      return `Ponte un tope semanal de ${fmt(weekly(ctx.capAmount))} para salidas y revísalo cada domingo.`;
    case 'vivienda':
      return 'Al renovar contrato, negocia la renta o evalúa una opción más accesible.';
    case 'carro': {
      const lead = 'Refinancia la cuota o cotiza otro seguro.';
      return ctx.variableSpent > 0
        ? `${lead} Lo variable (${fmt(ctx.variableSpent)}), como la gasolina, sí lo controlas día a día.`
        : lead;
    }
    case 'deudas':
      return 'Junta tus deudas en una con menor tasa o paga primero la más cara.';
    case 'suscripciones': {
      const lead = top ? `${top.name} fue ${fmt(top.amount)}. ` : '';
      return `${lead}Revisa cuáles no usaste este mes.`;
    }
  }
}

/**
 * Compara el gasto de cada tope con `tope × ingresos`.
 * pctIngreso = gasto / ingresos; si pasa el tope, ahorro = gasto − tope × ingresos.
 */
export function buildRecommendations(
  groups: CapGroupInput[],
  income: number,
  caps: Record<CapKey, number>,
  fmt: (n: number) => string,
): RecommendationResult {
  if (!(income > 0)) return { over: [], ok: [], potential: 0 };
  const over: Recommendation[] = [];
  const ok: CapOk[] = [];
  for (const g of groups) {
    if (!(g.spent > 0)) continue;
    const cap = caps[g.key];
    const pct = (g.spent / income) * 100;
    const capAmount = round2((cap / 100) * income);
    const saving = round2(g.spent - capAmount);
    const { name, emoji } = CAP_META[g.key];
    if (saving > 0) {
      over.push({
        key: g.key, name, emoji, spent: g.spent, pct, cap, capAmount, saving,
        kind: groupKind(g),
        advice: adviceFor(g.key, {
          saving, capAmount, variableSpent: round2(g.spent - g.fixedSpent), topSub: g.topSub,
        }, fmt),
      });
    } else {
      ok.push({ key: g.key, name, emoji, spent: g.spent, pct, cap });
    }
  }
  over.sort((a, b) => (a.kind === b.kind ? b.saving - a.saving : a.kind === 'variable' ? -1 : 1));
  ok.sort((a, b) => b.spent - a.spent);
  return { over, ok, potential: round2(over.reduce((a, r) => a + r.saving, 0)) };
}

// ── Plan del mes contra los topes ─────────────────────

/** Topes que el plan pasa: plan del tope > tope × ingresos. */
export function planOverCaps(
  planByKey: Partial<Record<CapKey, number>>,
  income: number,
  caps: Record<CapKey, number>,
): CapKey[] {
  if (!(income > 0)) return [];
  return CAP_KEYS.filter((k) => (planByKey[k] ?? 0) > round2((caps[k] / 100) * income) + 0.005);
}

/** "vivienda", "vivienda y alimentación", "vivienda, carro y alimentación". */
export function capListText(keys: CapKey[]): string {
  const names = keys.map((k) => CAP_META[k].name.toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export interface PlanItem {
  categoryId: string;
  key: CapKey | null;
  /** Plan mensual de la categoría. */
  plan: number;
  /** Partes con su monto mensual (vacío si la categoría no tiene partes). */
  parts: { id: string; monthly: number }[];
}

/** Plan mensual sumado por tope. */
export function planByCapKey(items: PlanItem[]): Partial<Record<CapKey, number>> {
  const out: Partial<Record<CapKey, number>> = {};
  for (const it of items) if (it.key) out[it.key] = round2((out[it.key] ?? 0) + it.plan);
  return out;
}

export interface PlanChange {
  kind: 'category' | 'part';
  /** Id de la categoría o de la parte. */
  id: string;
  categoryId: string;
  fromMonthly: number;
  toMonthly: number;
}

/**
 * "Aplicar a mi plan": baja el plan de cada tope elegido hasta `tope × ingresos`,
 * en proporción entre sus categorías (y partes). Montos enteros hacia abajo
 * para no pasarse del tope.
 */
export function capPlanChanges(
  items: PlanItem[],
  keys: CapKey[],
  income: number,
  caps: Record<CapKey, number>,
): PlanChange[] {
  if (!(income > 0)) return [];
  const changes: PlanChange[] = [];
  for (const key of keys) {
    const group = items.filter((it) => it.key === key && it.plan > 0);
    const total = group.reduce((a, it) => a + it.plan, 0);
    const target = (caps[key] / 100) * income;
    if (total <= target + 0.005) continue;
    const factor = target / total;
    for (const it of group) {
      if (it.parts.length > 0) {
        for (const p of it.parts) {
          if (!(p.monthly > 0)) continue;
          changes.push({ kind: 'part', id: p.id, categoryId: it.categoryId, fromMonthly: p.monthly, toMonthly: Math.floor(p.monthly * factor) });
        }
      } else {
        changes.push({ kind: 'category', id: it.categoryId, categoryId: it.categoryId, fromMonthly: it.plan, toMonthly: Math.floor(it.plan * factor) });
      }
    }
  }
  return changes;
}

// ── Proyección ────────────────────────────────────────

export type Horizon = 'year' | '12';

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Meses siguientes a `month`: hasta diciembre ('year') o los 12 siguientes. */
export function horizonMonths(month: string, horizon: Horizon): string[] {
  const m = Number(month.split('-')[1]);
  const n = horizon === 'year' ? 12 - m : 12;
  return Array.from({ length: n }, (_, i) => addMonths(month, i + 1));
}

export interface ProjectionPoint {
  month: string;
  /** Ahorro acumulado al ritmo actual. */
  base: number;
  /** Ahorro acumulado con los ajustes. */
  total: number;
}

export interface Projection {
  points: ProjectionPoint[];
  baseTotal: number;
  extraTotal: number;
  total: number;
}

/**
 * ahorroBase = ingresos − gastos del mes; extra = Σ ahorro de las
 * recomendaciones elegidas; se acumula mes a mes.
 */
export function projection(base: number, extra: number, months: string[]): Projection {
  const points = months.map((month, i) => ({
    month,
    base: round2(base * (i + 1)),
    total: round2((base + extra) * (i + 1)),
  }));
  const n = months.length;
  return { points, baseTotal: round2(base * n), extraTotal: round2(extra * n), total: round2((base + extra) * n) };
}
