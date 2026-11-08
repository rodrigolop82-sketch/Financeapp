// "¿En qué se fue el mes?" (Cómo te fue): reparto de las salidas del mes en Lo
// básico / Gustos / Ahorro, con el detalle por categoría contra el presupuesto
// y el mensaje de cómo va el gasto frente al ahorro. Puro (sin React ni
// Supabase). No suma nada por su cuenta: clasifica cada movimiento con
// `destinoDe` (lib/metricas-mes.ts), igual que "Gastaste" en todas las
// pantallas, y los totales vienen de `monthTotals`.
import { roundShares, savingsPct, type CtfCategory, type CtfTx, type MonthTotals } from './como-te-fue';
import { destinoDe, type InteresesDeuda } from './metricas-mes';

/** Lo sano es ahorrar 20 % de los ingresos (mismo número que Veredicto y Graficas). */
export const META_AHORRO_PCT = 20;

export type TipoKey = 'needs' | 'wants' | 'savings';
export type EstadoFila = 'over' | 'ok' | 'sin-plan';
export type EstadoTipo = 'over' | 'ok' | 'sin-plan' | 'meta' | 'bajo';
/** ok: dentro y ahorro ≥ 20 %. ok-bajo: dentro pero ahorro < 20 %. compensado: te pasaste pero ahorro ≥ 20 %. alerta: te pasaste y ahorro < 20 %. */
export type Tono = 'ok' | 'ok-bajo' | 'compensado' | 'alerta';

export interface CategoriaFila {
  /** Id de la categoría; null en las filas sin categoría real (Sin categoría, Intereses, Pagos a deudas). */
  id: string | null;
  nombre: string;
  gastado: number;
  /** Presupuesto del mes; null si la fila no tiene plan. */
  presupuesto: number | null;
  /** gastado − presupuesto (positivo = te pasaste); null sin presupuesto. */
  diff: number | null;
  estado: EstadoFila;
}

export interface TipoDetalle {
  key: TipoKey;
  label: string;
  monto: number;
  /** % de las salidas del mes; los tres tipos suman 100. */
  pct: number;
  /** Básico y gustos: suma de los planes. Ahorro: la meta (20 % de los ingresos). */
  presupuesto: number | null;
  diff: number | null;
  estado: EstadoTipo;
  categorias: CategoriaFila[];
}

export interface Variacion {
  /** Positivo = más que la referencia. */
  diff: number;
  /** Entero, con el mismo signo que `diff`. */
  pct: number;
}

export interface EnQueSeFue {
  month: string;
  /** gastaste + apartaste. */
  salidas: number;
  gastaste: number;
  apartaste: number;
  ingresos: number | null;
  /** (ingresos − gastaste) / ingresos, entero; null sin ingresos. */
  tasaAhorro: number | null;
  /** Presupuesto de gasto (básico + gustos); null sin plan. */
  presupuestoGasto: number | null;
  vsIngresos: Variacion | null;
  vsPresupuestoGasto: Variacion | null;
  tono: Tono | null;
  mensaje: string | null;
  tipos: TipoDetalle[];
}

export interface EnQueSeFueInput {
  month: string;
  totals: MonthTotals;
  /** Movimientos de varios meses o del mes: se usan solo los de `month`. */
  txs: CtfTx[];
  categories: CtfCategory[];
  /** Plan por categoría (con la foto del mes si ya cerró): `analyzeMonth().planOf`. */
  planOf: Record<string, number>;
  intereses?: InteresesDeuda;
  fmt: (n: number) => string;
}

const LABEL: Record<TipoKey, string> = { needs: 'Lo básico', wants: 'Gustos', savings: 'Ahorro' };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Se considera "te pasaste" desde Q 1, como categoryStatus. */
const over = (diff: number) => diff >= 1;

interface Acumulado {
  id: string | null;
  nombre: string;
  gastado: number;
}

function filas(acc: Map<string, Acumulado>, planOf: Record<string, number>, conPlan: boolean): CategoriaFila[] {
  const out = Array.from(acc.values()).map((a): CategoriaFila => {
    const plan = conPlan && a.id ? planOf[a.id] ?? 0 : 0;
    const gastado = round2(a.gastado);
    if (!(plan > 0)) return { id: a.id, nombre: a.nombre, gastado, presupuesto: null, diff: null, estado: 'sin-plan' };
    const diff = round2(gastado - plan);
    return { id: a.id, nombre: a.nombre, gastado, presupuesto: round2(plan), diff, estado: over(diff) ? 'over' : 'ok' };
  });
  return out.sort((x, y) => y.gastado - x.gastado || x.nombre.localeCompare(y.nombre, 'es'));
}

function tipo(key: TipoKey, monto: number, pct: number, categorias: CategoriaFila[]): TipoDetalle {
  const planes = categorias.filter((c) => c.presupuesto !== null);
  const presupuesto = planes.length > 0 ? round2(planes.reduce((a, c) => a + (c.presupuesto ?? 0), 0)) : null;
  if (presupuesto === null) return { key, label: LABEL[key], monto, pct, presupuesto: null, diff: null, estado: 'sin-plan', categorias };
  const diff = round2(monto - presupuesto);
  return { key, label: LABEL[key], monto, pct, presupuesto, diff, estado: over(diff) ? 'over' : 'ok', categorias };
}

function variacion(valor: number, base: number | null): Variacion | null {
  if (base === null || !(base > 0)) return null;
  const diff = round2(valor - base);
  return { diff, pct: Math.round((diff / base) * 100) };
}

/** Tono y mensaje: pasarse del presupuesto de gasto pesa distinto según cuánto ahorraste. */
function tonoYMensaje(
  gastoDiff: number | null,
  tasa: number | null,
  fmt: (n: number) => string,
): { tono: Tono | null; mensaje: string | null } {
  if (gastoDiff === null) return { tono: null, mensaje: null };
  const pasaste = over(gastoDiff);
  const sano = tasa !== null && tasa >= META_AHORRO_PCT;
  const sobre = fmt(Math.abs(gastoDiff));
  if (!pasaste) {
    if (tasa === null) return { tono: 'ok', mensaje: 'Dentro de tu plan de básico y gustos.' };
    if (sano) return { tono: 'ok', mensaje: `Dentro de tu plan de básico y gustos y ahorraste ${tasa}%.` };
    if (tasa < 0) return { tono: 'ok-bajo', mensaje: 'Dentro del plan, pero gastaste más de lo que recibiste.' };
    return { tono: 'ok-bajo', mensaje: `Dentro del plan, pero ahorraste solo ${tasa}% (meta ${META_AHORRO_PCT}%).` };
  }
  if (tasa === null) return { tono: 'alerta', mensaje: `Te pasaste ${sobre} en lo básico y gustos.` };
  if (sano) return { tono: 'compensado', mensaje: `Te pasaste ${sobre} en lo básico y gustos, pero ahorraste ${tasa}% (meta ${META_AHORRO_PCT}%).` };
  if (tasa < 0) return { tono: 'alerta', mensaje: `Te pasaste ${sobre} en lo básico y gustos y gastaste más de lo que recibiste.` };
  return { tono: 'alerta', mensaje: `Te pasaste ${sobre} en lo básico y gustos y ahorraste solo ${tasa}% (meta ${META_AHORRO_PCT}%).` };
}

/** null si el mes no tiene movimientos. */
export function enQueSeFue(input: EnQueSeFueInput): EnQueSeFue | null {
  const { month, totals, txs, categories, planOf, intereses, fmt } = input;
  if (!totals.hasData) return null;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket as string]));
  const acc: Record<TipoKey, Map<string, Acumulado>> = { needs: new Map(), wants: new Map(), savings: new Map() };

  const sumar = (k: TipoKey, id: string | null, nombre: string, monto: number) => {
    const key = id ?? `__${nombre}`;
    const fila = acc[k].get(key) ?? { id, nombre, gastado: 0 };
    fila.gastado += monto;
    acc[k].set(key, fila);
  };

  for (const tx of txs) {
    if (!tx.date.startsWith(month)) continue;
    const amt = Number(tx.amount) || 0;
    const destino = destinoDe(tx, bucketOf, intereses);
    if (destino === 'basico' || destino === 'gustos' || destino === 'apartado') {
      const k: TipoKey = destino === 'basico' ? 'needs' : destino === 'gustos' ? 'wants' : 'savings';
      const cat = tx.category_id ? byId.get(tx.category_id) : undefined;
      sumar(k, cat ? cat.id : null, cat ? cat.name : 'Sin categoría', amt);
    } else if (destino === 'deuda') {
      const interes = Math.min(Math.max(0, (tx.id && intereses?.get(tx.id)) || 0), Math.max(0, amt));
      if (interes > 0) sumar('needs', null, 'Intereses de deudas', interes);
      if (amt - interes > 0) sumar('savings', null, 'Pagos a deudas', amt - interes);
    }
  }

  // Categorías con plan pero sin gasto: cuentan en el presupuesto y se ven en "Te quedan".
  for (const c of categories) {
    if (c.archived_at) continue;
    const k: TipoKey | null = c.bucket === 'needs' ? 'needs' : c.bucket === 'wants' ? 'wants' : null;
    if (k && (planOf[c.id] ?? 0) > 0 && !acc[k].has(c.id)) acc[k].set(c.id, { id: c.id, nombre: c.name, gastado: 0 });
  }

  const gastaste = round2(totals.spent);
  const apartaste = round2(totals.savingsBucket);
  const salidas = round2(gastaste + apartaste);
  const ingresos = totals.hasIncome ? totals.income : null;
  const tasaAhorro = savingsPct(totals);

  const [pNeeds, pWants, pSav] = roundShares([totals.needs, totals.wants, apartaste]);
  const needs = tipo('needs', round2(totals.needs), pNeeds, filas(acc.needs, planOf, true));
  const wants = tipo('wants', round2(totals.wants), pWants, filas(acc.wants, planOf, true));

  const meta = ingresos !== null && ingresos > 0 ? round2((ingresos * META_AHORRO_PCT) / 100) : null;
  const ahorro: TipoDetalle = {
    key: 'savings', label: LABEL.savings, monto: apartaste, pct: pSav,
    presupuesto: meta,
    diff: meta === null ? null : round2(apartaste - meta),
    estado: meta === null ? 'sin-plan' : apartaste >= meta ? 'meta' : 'bajo',
    categorias: filas(acc.savings, planOf, false),
  };

  const presupuestoGasto = needs.presupuesto === null && wants.presupuesto === null
    ? null
    : round2((needs.presupuesto ?? 0) + (wants.presupuesto ?? 0));
  const vsPresupuestoGasto = variacion(gastaste, presupuestoGasto);
  const { tono, mensaje } = tonoYMensaje(vsPresupuestoGasto ? vsPresupuestoGasto.diff : null, tasaAhorro, fmt);

  return {
    month, salidas, gastaste, apartaste, ingresos, tasaAhorro, presupuestoGasto,
    vsIngresos: variacion(salidas, ingresos),
    vsPresupuestoGasto, tono, mensaje,
    tipos: [needs, wants, ahorro],
  };
}
