// Cálculos de la pantalla Inicio: cuánto puedes gastar hoy, estado del mes,
// alerta única y barras de "¿En qué se va?". Sin dependencias de React.
import { computeCategoryPace, type PaceMode } from './resumen/pace';
import { destinoDe, resumirMovimientos, type InteresesDeuda } from './metricas-mes';

export interface HomeCategory {
  id: string;
  name: string;
  bucket: string;
  budgeted_amount: number;
  icon?: string | null;
  archived_at?: string | null;
  pace_mode?: PaceMode | null;
  expected_day?: number | null;
}

export interface HomeTx {
  id?: string;
  category_id: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  date?: string;
  transaction_type?: string | null;
}

export type HomeStatus = 'bien' | 'cuidado' | 'pasaste';

export const STATUS_META: Record<HomeStatus, { label: string; dot: string; bar: string }> = {
  bien: { label: 'Vas bien', dot: '#22C55E', bar: '#22C55E' },
  cuidado: { label: 'Con cuidado', dot: '#F59E0B', bar: '#F59E0B' },
  pasaste: { label: 'Te pasaste', dot: '#EF4444', bar: '#EF4444' },
};

export type BarKind = 'ok' | 'cuidado' | 'excedida';

export interface CategoryBar {
  id: string;
  name: string;
  icon?: string | null;
  bucket: string;
  spent: number;
  budget: number;
  ratio: number;
  kind: BarKind;
}

export interface CategorySpend {
  id: string;
  name: string;
  icon?: string | null;
  bucket: string;
  spent: number;
}

export interface HomeSummary {
  /** Lo planeado en básico + gustos (0 = sin plan). */
  budget: number;
  /** Apartado para fijos que faltan (inicio de mes). */
  reserved: number;
  spent: number;
  left: number;
  daysLeft: number;
  perDay: number;
  pct: number;
  status: HomeStatus;
  overCategory: { id: string; name: string; icon?: string | null; bucket: string; excess: number } | null;
  catBars: CategoryBar[];
  /** Gasto por categoría (para el estado sin plan). */
  spendByCategory: CategorySpend[];
}

export function barKind(ratio: number): BarKind {
  if (ratio > 1) return 'excedida';
  if (ratio >= 0.85) return 'cuidado';
  return 'ok';
}

/**
 * Resumen del mes en curso. `today` es la fecha local; `monthTx` son los
 * movimientos del mes (gastos e ingresos). `reserved` es lo apartado en el
 * inicio de mes para los fijos que faltan: no cuenta como disponible.
 */
export function computeHome(categories: HomeCategory[], monthTx: HomeTx[], today: Date, reserved = 0, intereses?: InteresesDeuda): HomeSummary {
  const active = categories.filter((c) => c.bucket !== 'income' && !c.archived_at);
  // "Hoy puedes gastar" sale de básico + gustos; lo que apartas para metas no se gasta.
  const spendable = active.filter((c) => c.bucket !== 'savings');
  const budget = spendable.reduce((s, c) => s + Math.max(0, Number(c.budgeted_amount) || 0), 0);

  // "Gastaste" del mes: la misma cuenta que Cómo te fue (lib/metricas-mes).
  const txs = monthTx.map((t) => ({ ...t, date: t.date ?? '' }));
  const spent = resumirMovimientos(txs, categories, intereses).consumo;
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket]));
  const spentBy: Record<string, number> = {};
  for (const t of txs) {
    const d = destinoDe(t, bucketOf, intereses);
    if (t.category_id && (d === 'basico' || d === 'gustos')) spentBy[t.category_id] = (spentBy[t.category_id] ?? 0) + Number(t.amount);
  }

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysLeft = daysInMonth - dayOfMonth + 1;
  const left = budget - spent;
  const perDay = budget > 0 ? Math.max(0, Math.round((left - reserved) / daysLeft)) : 0;
  const pct = budget > 0 ? spent / budget : 0;

  // Ritmo esperado a la fecha según cada categoría (lineal o pago fijo).
  const ctx = { today, daysInMonth, dayOfMonth };
  const expected = spendable.reduce((s, c) => s + computeCategoryPace({
    categoryId: c.id,
    name: c.name,
    budget: Number(c.budgeted_amount) || 0,
    spent: spentBy[c.id] ?? 0,
    paceMode: c.pace_mode ?? 'linear',
    expectedDay: c.expected_day ?? null,
  }, ctx).expected, 0);

  let status: HomeStatus = 'bien';
  if (budget > 0 && pct >= 1) status = 'pasaste';
  else if (budget > 0 && (pct >= 0.85 || spent > expected * 1.05)) status = 'cuidado';

  let overCategory: HomeSummary['overCategory'] = null;
  for (const c of active) {
    const b = Number(c.budgeted_amount) || 0;
    const excess = (spentBy[c.id] ?? 0) - b;
    if (b > 0 && excess > 0 && (!overCategory || excess > overCategory.excess)) {
      overCategory = { id: c.id, name: c.name, icon: c.icon, bucket: c.bucket, excess };
    }
  }

  const catBars: CategoryBar[] = active
    .filter((c) => Number(c.budgeted_amount) > 0 && (spentBy[c.id] ?? 0) > 0)
    .map((c) => {
      const b = Number(c.budgeted_amount);
      const s = spentBy[c.id];
      return { id: c.id, name: c.name, icon: c.icon, bucket: c.bucket, spent: s, budget: b, ratio: s / b, kind: barKind(s / b) };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const spendByCategory: CategorySpend[] = categories
    .filter((c) => c.bucket !== 'income' && (spentBy[c.id] ?? 0) > 0)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, bucket: c.bucket, spent: spentBy[c.id] }))
    .sort((a, b) => b.spent - a.spent);

  return { budget, reserved, spent, left, daysLeft, perDay, pct, status, overCategory, catBars, spendByCategory };
}

export type LoQueSigueKind = 'ingreso' | 'cierre' | 'inicio-mes' | 'sin-registrar' | 'paso' | 'ahorro';

export interface LoQueSigueItem {
  kind: LoQueSigueKind;
  /** Para "Ahora no" (se guarda por mes). */
  key: string;
  title: string;
  body: string;
  /** Mes a cerrar (solo `cierre`). */
  month?: string;
}

export interface LoQueSigueInput {
  /** Hoy, 'YYYY-MM-DD'. */
  today: string;
  monthName: string;
  prevMonth: string;
  prevMonthName: string;
  /** Hay ingresos registrados este mes (lib/metricas-mes). */
  hasIncome: boolean;
  /** Ingreso mensual del plan (0 si no hay). */
  plannedIncome: number;
  /** Nombre de la fuente de ingreso del plan ("Salario") o null. */
  incomeName: string | null;
  /** Primer día esperado de ingreso del plan (null si no se sabe). */
  expectedDay: number | null;
  prevMonthClosed: boolean;
  monthStartPending: boolean;
  daysSinceLast: number | null;
  paso: { title: string; efecto: string } | null;
  savings: { title: string; subtitle: string } | null;
  fmt: (n: number) => string;
}

/**
 * "Lo que sigue" en Inicio (C11): un solo aviso a la vez, por prioridad:
 * registrar ingreso › cerrar el mes anterior (días 1–5) › empezar el mes
 * (fijos) › días sin registrar › siguiente mejor paso › ahorro del mes.
 */
export function loQueSigue(i: LoQueSigueInput): LoQueSigueItem[] {
  const out: LoQueSigueItem[] = [];
  const month = i.today.slice(0, 7);
  const day = Number(i.today.slice(8, 10));
  if (!i.hasIncome && i.plannedIncome > 0 && (i.expectedDay === null || day >= i.expectedDay)) {
    const fuente = (i.incomeName ?? 'ingreso').toLowerCase();
    out.push({
      kind: 'ingreso', key: `ingreso:${month}`,
      title: `Registra tu ${fuente} de ${i.monthName}`,
      body: `Tu plan espera ${i.fmt(i.plannedIncome)}. Sin un ingreso registrado, Zafi no puede calcular tu ahorro ni tu puntaje del mes.`,
    });
  }
  if (day >= 1 && day <= 5 && !i.prevMonthClosed) {
    out.push({
      kind: 'cierre', key: `cierre:${i.prevMonth}`, month: i.prevMonth,
      title: `Cierra ${i.prevMonthName}`,
      body: 'Confirma tus ingresos y tus estados de cuenta para guardar tu puntaje del mes.',
    });
  }
  if (i.monthStartPending) {
    out.push({
      kind: 'inicio-mes', key: `inicio-mes:${month}`,
      title: `Empieza ${i.monthName}`,
      body: 'Confirma tu salario y aparta tus pagos fijos para que "Hoy puedes gastar" sea real.',
    });
  }
  if (i.daysSinceLast !== null && i.daysSinceLast >= 3 && i.daysSinceLast <= 90) {
    out.push({
      kind: 'sin-registrar', key: `sin-registrar:${i.today}`,
      title: `Hace ${i.daysSinceLast} días que no registras un movimiento`,
      body: 'Anota lo que has gastado para que tus números sigan al día.',
    });
  }
  if (i.paso) out.push({ kind: 'paso', key: `paso:${month}`, title: i.paso.title, body: i.paso.efecto });
  if (i.savings) out.push({ kind: 'ahorro', key: `ahorro:${month}`, title: i.savings.title, body: i.savings.subtitle });
  return out;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Sábado 3 de octubre". */
export function headerDate(d: Date): string {
  const w = d.toLocaleDateString('es-GT', { weekday: 'long' });
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** Iniciales de un nombre completo ("Ana Pérez" → "AP"). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
