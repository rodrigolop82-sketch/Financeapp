// Gasto por día y días sin gasto de un mes (F10, "Cómo te fue"). Puro, sin
// React ni Supabase.
//
// Reglas:
// - Solo cuentan días completos: en el mes en curso, hoy y los días futuros
//   quedan fuera; en meses cerrados cuentan todos.
// - "Gasto" es lo mismo que suma "Gastaste" (monthTotals): type='expense'
//   fuera de Ahorro y deudas (savings) y de categorías de ingreso. Sin
//   categoría cuenta como gasto.
// - Un día sin gasto es un día completo sin ningún gasto; los ingresos no lo
//   rompen.
// - Las transferencias (transaction_type='transferencia', cuando existan) no
//   cuentan. Los gastos de antes de usar Zafi sí cuentan como gasto real.

export const MIN_COMPLETE_DAYS = 3;

export interface DailySpendTx {
  amount: number | string;
  type: 'expense' | 'income';
  date: string; // YYYY-MM-DD
  category_id: string | null;
  transaction_type?: string | null;
}

export interface DailySpendCategory {
  id: string;
  bucket: string;
}

export interface DailySpend {
  /** Días completos del mes (0 para meses futuros). */
  completeDays: number;
  /** Gasto en los días completos. */
  spent: number;
  /** Gasto promedio por día completo (0 sin días completos). */
  avgPerDay: number;
  /** Días completos sin ningún gasto. */
  daysWithoutSpend: number;
  /** Hay al menos MIN_COMPLETE_DAYS días completos para mostrar números. */
  enough: boolean;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Días completos de `month` ('YYYY-MM') vistos desde `today` ('YYYY-MM-DD'). */
export function completeDaysOf(month: string, today: string): number {
  const current = today.slice(0, 7);
  if (month < current) return daysInMonth(month);
  if (month > current) return 0;
  return Number(today.slice(8, 10)) - 1;
}

export function dailySpend(
  month: string,
  today: string,
  txs: DailySpendTx[],
  categories: DailySpendCategory[],
): DailySpend {
  const completeDays = completeDaysOf(month, today);
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket]));
  const lastDay = `${month}-${String(completeDays).padStart(2, '0')}`;

  let spent = 0;
  const daysWithSpend = new Set<string>();
  for (const tx of txs) {
    if (!tx.date.startsWith(month) || tx.date > lastDay) continue;
    if (tx.type !== 'expense' || tx.transaction_type === 'transferencia') continue;
    const bucket = tx.category_id ? bucketOf.get(tx.category_id) ?? 'needs' : 'needs';
    if (bucket === 'savings' || bucket === 'income') continue;
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;
    spent += amt;
    daysWithSpend.add(tx.date.slice(0, 10));
  }

  spent = Math.round(spent * 100) / 100;
  return {
    completeDays,
    spent,
    avgPerDay: completeDays > 0 ? Math.round((spent / completeDays) * 100) / 100 : 0,
    daysWithoutSpend: Math.max(0, completeDays - daysWithSpend.size),
    enough: completeDays >= MIN_COMPLETE_DAYS,
  };
}
