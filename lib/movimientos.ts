// Helpers puros de la pantalla Movimientos y la hoja de agregar.
// Las fechas son strings locales 'YYYY-MM-DD' (ver lib/dates.ts).
import { getMerchantKey } from './transactions/merchant-key';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function weekday(date: string): string {
  return capitalize(parseDate(date).toLocaleDateString('es-GT', { weekday: 'long' }));
}

/** "Hoy", "Ayer" o "Lunes 29". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  return `${weekday(date)} ${parseDate(date).getDate()}`;
}

/** "Hoy, 3 de octubre", "Ayer, 2 de octubre" o "Lunes 29 de septiembre". */
export function longDate(date: string, today: string): string {
  const d = parseDate(date);
  const tail = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  if (date === today) return `Hoy, ${tail}`;
  if (date === addDays(today, -1)) return `Ayer, ${tail}`;
  const year = d.getFullYear() !== parseDate(today).getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${weekday(date)} ${tail}${year}`;
}

/** Primer y último día de un mes 'YYYY-MM'. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** "Octubre", o "Octubre 2025" si no es del año en curso. */
export function monthLabel(month: string, today: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = capitalize(MONTHS[m - 1]);
  return y === parseDate(today).getFullYear() ? name : `${name} ${y}`;
}

/** Los últimos `n` meses 'YYYY-MM', empezando por el actual. */
export function recentMonths(today: string, n: number): string[] {
  const d = parseDate(today);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Hoy y los 6 días anteriores. */
export function recentDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -i));
}

/** Deja solo dígitos y un punto decimal. */
export function cleanAmountInput(value: string): string {
  const only = value.replace(/[^\d.]/g, '');
  const dot = only.indexOf('.');
  return dot === -1 ? only : only.slice(0, dot + 1) + only.slice(dot + 1).replace(/\./g, '');
}

export interface DayRow {
  id: string;
  date: string;
  amount: number | string;
  type: 'expense' | 'income';
}

export interface DayGroup<T extends DayRow> {
  date: string;
  label: string;
  /** Total de gastos del día (los ingresos no suman). */
  expenseTotal: number;
  rows: T[];
}

/** Agrupa filas ya ordenadas por fecha descendente. */
export function groupByDay<T extends DayRow>(rows: T[], today: string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const row of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== row.date) {
      g = { date: row.date, label: dayLabel(row.date, today), expenseTotal: 0, rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
    if (row.type !== 'income') g.expenseTotal += Number(row.amount);
  }
  return groups;
}

/**
 * Otros movimientos cargados del mismo comercio que todavía no tienen la
 * categoría nueva (para "Cambiar también los otros N").
 */
export function sameMerchantOthers<T extends { id: string; description: string | null; category_id: string | null }>(
  rows: T[],
  tx: T,
  newCategoryId: string,
): T[] {
  const key = getMerchantKey(tx.description);
  if (!key) return [];
  return rows.filter((r) => r.id !== tx.id && r.category_id !== newCategoryId && getMerchantKey(r.description) === key);
}

/**
 * Las categorías más usadas primero (según `counts`), completando con el
 * resto en su orden original hasta `n`.
 */
export function topCategories<T extends { id: string }>(categories: T[], counts: Record<string, number>, n: number): T[] {
  const used = categories
    .filter((c) => (counts[c.id] ?? 0) > 0)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  const rest = categories.filter((c) => !(counts[c.id] > 0));
  return [...used, ...rest].slice(0, n);
}
