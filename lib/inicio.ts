// Cálculos de la pantalla Inicio: cuánto puedes gastar hoy, estado del mes,
// alerta única y barras de "¿En qué se va?". Sin dependencias de React.
import { computeCategoryPace, type PaceMode } from './resumen/pace';

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
  category_id: string | null;
  amount: number | string;
  type: 'expense' | 'income';
}

export type HomeStatus = 'bien' | 'cuidado' | 'pasaste';

export const STATUS_META: Record<HomeStatus, { label: string; dot: string; bar: string }> = {
  bien: { label: 'Vas bien', dot: '#22C55E', bar: '#3B82F6' },
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
  /** Suma de lo planeado en categorías de gasto activas (0 = sin plan). */
  budget: number;
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
 * movimientos del mes (gastos e ingresos).
 */
export function computeHome(categories: HomeCategory[], monthTx: HomeTx[], today: Date): HomeSummary {
  const active = categories.filter((c) => c.bucket !== 'income' && !c.archived_at);
  const budget = active.reduce((s, c) => s + Math.max(0, Number(c.budgeted_amount) || 0), 0);

  const expenses = monthTx.filter((t) => t.type !== 'income');
  const spent = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const spentBy: Record<string, number> = {};
  for (const t of expenses) {
    if (t.category_id) spentBy[t.category_id] = (spentBy[t.category_id] ?? 0) + Number(t.amount);
  }

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysLeft = daysInMonth - dayOfMonth + 1;
  const left = budget - spent;
  const perDay = budget > 0 ? Math.max(0, Math.round(left / daysLeft)) : 0;
  const pct = budget > 0 ? spent / budget : 0;

  // Ritmo esperado a la fecha según cada categoría (lineal o pago fijo).
  const ctx = { today, daysInMonth, dayOfMonth };
  const expected = active.reduce((s, c) => s + computeCategoryPace({
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

  return { budget, spent, left, daysLeft, perDay, pct, status, overCategory, catBars, spendByCategory };
}

export type HomeAlert =
  | { kind: 'excedida'; categoryId: string; name: string; icon?: string | null; bucket: string; excess: number }
  | { kind: 'sin-registrar'; days: number }
  | { kind: 'ahorro'; title: string; subtitle: string };

/**
 * Una sola alerta, por prioridad: categoría excedida > 3 o más días sin
 * registrar > ahorro del mes.
 */
export function pickHomeAlert(params: {
  overCategory: HomeSummary['overCategory'];
  daysSinceLastTransaction: number | null;
  savings: { title: string; subtitle: string } | null;
}): HomeAlert | null {
  const { overCategory, daysSinceLastTransaction, savings } = params;
  if (overCategory) {
    return { kind: 'excedida', categoryId: overCategory.id, name: overCategory.name, icon: overCategory.icon, bucket: overCategory.bucket, excess: overCategory.excess };
  }
  if (daysSinceLastTransaction !== null && daysSinceLastTransaction >= 3 && daysSinceLastTransaction <= 90) {
    return { kind: 'sin-registrar', days: daysSinceLastTransaction };
  }
  if (savings) return { kind: 'ahorro', ...savings };
  return null;
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
