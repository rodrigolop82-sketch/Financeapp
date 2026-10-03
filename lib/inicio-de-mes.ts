// Inicio de mes (Fase 6): lo apartado para los fijos que faltan, los
// ingresos con los que se cuenta y el "Hoy puedes gastar" que resulta.
// Sin React ni Supabase para poder probarlo con vitest.
import {
  incomeMonthly, planLeaves, type Leaf, type PlanCategory, type PlanIncome, type PlanSubItem,
} from './plan-del-mes';

export interface MonthStartItem {
  kind: 'expense' | 'income';
  category_id?: string | null;
  sub_item_id?: string | null;
  income_entry_id?: string | null;
  counted: boolean;
}

/** Lo elegido en la hoja "Empieza {mes}": id de la hoja o del ingreso → contado. */
export interface MonthChoices {
  expense: Record<string, boolean>;
  income: Record<string, boolean>;
}

/** Id de una hoja guardada en month_start_items (parte o categoría sin partes). */
export function itemLeafId(item: Pick<MonthStartItem, 'category_id' | 'sub_item_id'>): string | null {
  return item.sub_item_id ?? item.category_id ?? null;
}

export function choicesFromItems(items: MonthStartItem[]): MonthChoices {
  const out: MonthChoices = { expense: {}, income: {} };
  for (const it of items) {
    if (it.kind === 'income' && it.income_entry_id) out.income[it.income_entry_id] = it.counted;
    if (it.kind === 'expense') {
      const id = itemLeafId(it);
      if (id) out.expense[id] = it.counted;
    }
  }
  return out;
}

/** Hojas fijas de básico y gustos: una parte fija o una categoría fija sin partes. */
export function fixedLeaves(categories: PlanCategory[], subs: PlanSubItem[]): Leaf[] {
  return planLeaves(categories, subs).filter((l) => l.fixed && (l.bucket === 'needs' || l.bucket === 'wants'));
}

/** Lo gastado este mes en una hoja: por parte (budget_sub_item_id) o por categoría. */
export function leafSpent(leaf: Leaf, spentByCategory: Record<string, number>, spentBySub: Record<string, number>): number {
  return leaf.id === leaf.categoryId ? spentByCategory[leaf.id] ?? 0 : spentBySub[leaf.id] ?? 0;
}

/** pendiente(h) = max(0, plan − gastado). */
export function leafPending(leaf: Leaf, spentByCategory: Record<string, number>, spentBySub: Record<string, number>): number {
  return Math.max(0, leaf.plan - leafSpent(leaf, spentByCategory, spentBySub));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Hoja apartada: si no se eligió nada para ella, cuenta como apartada (por defecto, todo encendido). */
export function isCounted(choices: MonthChoices | null, kind: 'expense' | 'income', id: string): boolean {
  return choices?.[kind][id] ?? true;
}

export interface Reserve {
  /** Suma de pendiente(h) de las hojas apartadas. 0 si no se hizo el inicio de mes. */
  reserved: number;
  /** Cuántas hojas apartadas todavía tienen algo pendiente. */
  pendingCount: number;
}

/** Lo apartado este mes. `choices` es null si no hay inicio de mes. */
export function computeReserve(
  leaves: Leaf[],
  choices: MonthChoices | null,
  spentByCategory: Record<string, number>,
  spentBySub: Record<string, number>,
): Reserve {
  if (!choices) return { reserved: 0, pendingCount: 0 };
  let reserved = 0;
  let pendingCount = 0;
  for (const l of leaves) {
    if (!isCounted(choices, 'expense', l.id)) continue;
    const p = leafPending(l, spentByCategory, spentBySub);
    if (p > 0) { reserved += p; pendingCount++; }
  }
  return { reserved: round2(reserved), pendingCount };
}

/** Días que faltan, contando hoy. */
export function daysLeftInMonth(today: Date): number {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return daysInMonth - today.getDate() + 1;
}

/** perDay = max(0, (plan_gastos − gastado − apartado) / daysLeft), en quetzales. */
export function perDay(planSpend: number, spent: number, reserved: number, daysLeft: number): number {
  if (planSpend <= 0 || daysLeft <= 0) return 0;
  return Math.max(0, Math.round((planSpend - spent - reserved) / daysLeft));
}

/**
 * Lo que cuenta de un ingreso este mes:
 * variable → max(recibido, monto); fijo que no se cuenta → solo lo recibido;
 * fijo en cualquier otro caso → max(recibido, monto).
 */
export function countedIncome(
  entry: Pick<PlanIncome, 'id' | 'amount' | 'frequency' | 'is_fixed'>,
  received: number,
  choices: MonthChoices | null,
): number {
  const amount = incomeMonthly(entry);
  const fixed = entry.is_fixed ?? true;
  if (fixed && choices && choices.income[entry.id] === false) return received;
  return Math.max(received, amount);
}

export function totalCountedIncome(
  incomes: PlanIncome[],
  received: Record<string, number>,
  choices: MonthChoices | null,
): number {
  return round2(incomes.reduce((a, e) => a + countedIncome(e, received[e.id] ?? 0, choices), 0));
}

/**
 * Elecciones con las que abre la hoja: las de este mes si ya se hizo, si no
 * las del mes anterior, y lo que falte, encendido.
 */
export function initialChoices(
  leaves: Leaf[],
  fixedIncomeIds: string[],
  current: MonthChoices | null,
  previous: MonthChoices | null,
): MonthChoices {
  const base = current ?? previous;
  const out: MonthChoices = { expense: {}, income: {} };
  for (const l of leaves) out.expense[l.id] = base?.expense[l.id] ?? true;
  for (const id of fixedIncomeIds) out.income[id] = base?.income[id] ?? true;
  return out;
}

/** Filas para month_start_items. */
export function itemsFromChoices(leaves: Leaf[], fixedIncomeIds: string[], choices: MonthChoices): MonthStartItem[] {
  const items: MonthStartItem[] = leaves.map((l) => ({
    kind: 'expense',
    category_id: l.categoryId,
    sub_item_id: l.id === l.categoryId ? null : l.id,
    income_entry_id: null,
    counted: choices.expense[l.id] ?? true,
  }));
  for (const id of fixedIncomeIds) {
    items.push({ kind: 'income', category_id: null, sub_item_id: null, income_entry_id: id, counted: choices.income[id] ?? true });
  }
  return items;
}

/** "Apartaste Q x para n pagos que faltan" o "Tus fijos de este mes ya están pagados". */
export function monthStartSummary(reserve: Reserve, fmt: (n: number) => string): string {
  if (reserve.reserved <= 0) return 'Tus fijos de este mes ya están pagados';
  return `Apartaste ${fmt(reserve.reserved)} para ${reserve.pendingCount} ${reserve.pendingCount === 1 ? 'pago que falta' : 'pagos que faltan'}`;
}
