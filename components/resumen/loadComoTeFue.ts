'use client';

// Carga de datos de "Cómo te fue" y su detalle: categorías, plan vigente,
// topes y los movimientos de la ventana de meses que se grafica.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserHousehold } from '@/lib/household';
import { monthRange } from '@/lib/movimientos';
import { resolveCaps, type CapKey } from '@/lib/recomendaciones';
import type { CtfCategory, CtfTx } from '@/lib/como-te-fue';
import type { BudgetSubItem, IncomeEntry } from '@/types';

export interface CtfData {
  householdId: string;
  userName: string;
  householdName: string;
  /** Todas, también las archivadas (sus movimientos viejos siguen contando). */
  categories: CtfCategory[];
  subs: BudgetSubItem[];
  incomes: IncomeEntry[];
  /** Movimientos de `from` a `to` (meses 'YYYY-MM', ambos incluidos). */
  txs: CtfTx[];
  caps: Record<CapKey, number>;
  /** Plan guardado al cerrar el mes (budget_snapshots) por categoría. */
  snapshots: Record<string, number>;
  /** Primer mes con movimientos (null si no hay ninguno). */
  earliest: string | null;
}

export type CtfLoad = { status: 'login' } | { status: 'onboarding' } | { status: 'ok'; data: CtfData };

const PAGE = 1000;

/** Movimientos del rango, paginados (PostgREST corta en 1000 filas). */
async function fetchTxs(supabase: SupabaseClient, hid: string, from: string, to: string): Promise<CtfTx[]> {
  const run = async (cols: string) => {
    const rows: CtfTx[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from('transactions')
        .select(cols)
        .eq('household_id', hid)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) return { rows, error };
      rows.push(...((data ?? []) as unknown as CtfTx[]));
      if (!data || data.length < PAGE) return { rows, error: null };
    }
  };
  const first = await run('id, category_id, budget_sub_item_id, amount, type, date, description');
  if (!first.error) return first.rows;
  // Sin la migración del Plan del mes no existe budget_sub_item_id.
  return (await run('id, category_id, amount, type, date, description')).rows;
}

export async function loadComoTeFue(
  supabase: SupabaseClient,
  opts: { from: string; to: string; snapshotMonth?: string | null },
): Promise<CtfLoad> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'login' };
  const hh = await getUserHousehold(supabase, user.id);
  if (!hh) return { status: 'onboarding' };
  const hid = hh.id as string;

  const [profileRes, catsRes, subsRes, incomesRes, capsRes, earliestRes, txs, snapRes] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', user.id).single(),
    supabase.from('budget_categories').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
    supabase.from('budget_sub_items').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
    supabase.from('income_entries').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
    // Sin la migración de topes la consulta falla y se usan los recomendados.
    supabase.from('spending_caps').select('cap_key, pct').eq('household_id', hid),
    supabase.from('transactions').select('date').eq('household_id', hid).order('date', { ascending: true }).limit(1),
    fetchTxs(supabase, hid, monthRange(opts.from).from, monthRange(opts.to).to),
    opts.snapshotMonth
      ? supabase.from('budget_snapshots').select('category_id, amount').eq('household_id', hid).eq('month', `${opts.snapshotMonth}-01`)
      : Promise.resolve({ data: [] as { category_id: string; amount: number }[] }),
  ]);

  const snapshots: Record<string, number> = {};
  for (const s of (snapRes.data ?? []) as { category_id: string; amount: number | string }[]) {
    snapshots[s.category_id] = Number(s.amount) || 0;
  }
  const first = (earliestRes.data as { date: string }[] | null)?.[0]?.date ?? null;
  const fullName = ((profileRes.data as { full_name?: string } | null)?.full_name || '') as string;

  return {
    status: 'ok',
    data: {
      householdId: hid,
      userName: fullName.split(' ')[0] ?? '',
      householdName: (hh.name as string) ?? '',
      categories: (catsRes.data ?? []) as CtfCategory[],
      subs: (subsRes.data ?? []) as BudgetSubItem[],
      incomes: (incomesRes.data ?? []) as IncomeEntry[],
      txs,
      caps: resolveCaps(capsRes.error ? null : (capsRes.data as { cap_key: string; pct: number }[] | null)),
      snapshots,
      earliest: first ? first.slice(0, 7) : null,
    },
  };
}
