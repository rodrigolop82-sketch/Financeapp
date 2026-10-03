// Lectura y guardado del inicio de mes (month_starts / month_start_items).
import type { SupabaseClient } from '@supabase/supabase-js';
import { choicesFromItems, type MonthChoices, type MonthStartItem } from './inicio-de-mes';
import { previousMonth } from './plan-del-mes';

export interface MonthStartState {
  /** Ya se hizo el inicio de este mes. */
  done: boolean;
  remind: boolean;
  /** Elecciones de este mes (null si no se hizo). */
  current: MonthChoices | null;
  /** Elecciones del mes anterior, para traerlas marcadas. */
  previous: MonthChoices | null;
}

export const EMPTY_MONTH_START: MonthStartState = { done: false, remind: true, current: null, previous: null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

/** Si las tablas no existen todavía (migración sin aplicar), se toma como no hecho. */
export async function loadMonthStart(supabase: Client, householdId: string, month: string): Promise<MonthStartState> {
  const prev = previousMonth(month);
  const [{ data: starts, error }, { data: items }] = await Promise.all([
    supabase.from('month_starts').select('year_month, remind_monthly').eq('household_id', householdId).in('year_month', [month, prev]),
    supabase.from('month_start_items')
      .select('year_month, kind, category_id, sub_item_id, income_entry_id, counted')
      .eq('household_id', householdId)
      .in('year_month', [month, prev]),
  ]);
  if (error) return EMPTY_MONTH_START;
  const rows = (starts ?? []) as { year_month: string; remind_monthly: boolean }[];
  const all = (items ?? []) as (MonthStartItem & { year_month: string })[];
  const cur = rows.find((r) => r.year_month === month);
  const before = rows.find((r) => r.year_month === prev);
  return {
    done: !!cur,
    remind: (cur ?? before)?.remind_monthly ?? true,
    current: cur ? choicesFromItems(all.filter((i) => i.year_month === month)) : null,
    previous: before ? choicesFromItems(all.filter((i) => i.year_month === prev)) : null,
  };
}

/**
 * Guarda el inicio de mes: month_starts, las elecciones (se reemplazan las
 * del mes) y la confirmación de ingresos para "Cerrar el mes".
 */
export async function saveMonthStart(
  supabase: Client,
  householdId: string,
  month: string,
  items: MonthStartItem[],
  remind: boolean,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error: e1 } = await supabase.from('month_starts').upsert(
    { household_id: householdId, year_month: month, completed_at: now, remind_monthly: remind },
    { onConflict: 'household_id,year_month' },
  );
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from('month_start_items').delete().eq('household_id', householdId).eq('year_month', month);
  if (e2) return { error: e2.message };
  if (items.length > 0) {
    const { error: e3 } = await supabase.from('month_start_items').insert(
      items.map((i) => ({ ...i, household_id: householdId, year_month: month })),
    );
    if (e3) return { error: e3.message };
  }
  await supabase.from('income_month_confirmations').upsert(
    { household_id: householdId, year_month: month, confirmed: true, confirmed_at: now },
    { onConflict: 'household_id,year_month' },
  );
  return { error: null };
}

/**
 * ¿El gasto recién guardado cae en una hoja fija apartada? Sirve para el
 * toast "Lo juntamos con lo que ya habías apartado".
 */
export async function isReservedLeaf(
  supabase: Client,
  householdId: string,
  month: string,
  leaf: { categoryId: string; subItemId: string | null },
): Promise<boolean> {
  const { data: start } = await supabase.from('month_starts').select('id').eq('household_id', householdId).eq('year_month', month).maybeSingle();
  if (!start) return false;
  if (leaf.subItemId) {
    const { data: sub } = await supabase.from('budget_sub_items').select('is_fixed').eq('id', leaf.subItemId).maybeSingle();
    if (!sub?.is_fixed) return false;
  } else {
    const { data: cat } = await supabase.from('budget_categories').select('pace_mode, bucket').eq('id', leaf.categoryId).maybeSingle();
    if (!cat || cat.pace_mode !== 'fixed' || (cat.bucket !== 'needs' && cat.bucket !== 'wants')) return false;
  }
  let q = supabase.from('month_start_items').select('counted').eq('household_id', householdId).eq('year_month', month).eq('kind', 'expense');
  q = leaf.subItemId ? q.eq('sub_item_id', leaf.subItemId) : q.eq('category_id', leaf.categoryId).is('sub_item_id', null);
  const { data: items } = await q;
  const rows = (items ?? []) as { counted: boolean }[];
  // Una hoja que no estaba en la lista cuenta como apartada (todo va encendido por defecto).
  return rows.length === 0 || rows[0].counted;
}
