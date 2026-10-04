// Datos del cron de avisos (solo servidor, service role). Junta lo que
// necesita lib/avisos.ts para decidir el aviso de cada usuario. Cada lectura
// tolera tablas o columnas que todavía no existan (migraciones sin aplicar).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserHousehold } from '@/lib/household';
import { addDays, resolveAvisoPrefs, type AvisoData, type AvisoPrefs, type LogEntry } from '@/lib/avisos';
import { resolveCaps } from '@/lib/recomendaciones';
import type { CtfCategory } from '@/lib/como-te-fue';
import type { PlanIncome, PlanSubItem } from '@/lib/plan-del-mes';

/** Usuarios con al menos un teléfono suscrito (solo a ellos les puede llegar algo). */
export async function usersWithDevices(admin: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await admin.from('push_subscriptions').select('user_id').range(from, from + 999);
    if (error) { console.warn('[avisos] No se pudo leer push_subscriptions', error.message); break; }
    for (const r of (data ?? []) as { user_id: string }[]) ids.add(r.user_id);
    if (!data || data.length < 1000) break;
  }
  return Array.from(ids);
}

export interface UserAvisoContext {
  prefs: AvisoPrefs;
  data: AvisoData;
  log: LogEntry[];
}

/** Todo lo que hace falta para decidir el aviso de hoy de un usuario. */
export async function loadUserAvisoContext(
  admin: SupabaseClient,
  userId: string,
  today: string,
  nowMs: number,
): Promise<UserAvisoContext | null> {
  const household = await getUserHousehold(admin, userId);
  if (!household) return null;
  const hh = household.id;
  const month = today.slice(0, 7);
  const prevStart = `${addDays(`${month}-01`, -1).slice(0, 7)}-01`;
  const since = new Date(nowMs - 40 * 86_400_000).toISOString();

  const [prefsRes, catsRes, subsRes, incRes, capsRes, txRes, lastRes, logRes, startRes] = await Promise.all([
    admin.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('budget_categories').select('*').eq('household_id', hh),
    admin.from('budget_sub_items').select('*').eq('household_id', hh),
    admin.from('income_entries').select('*').eq('household_id', hh),
    admin.from('spending_caps').select('cap_key, pct').eq('household_id', hh),
    admin.from('transactions').select('*').eq('household_id', hh).gte('date', prevStart).limit(5000),
    admin.from('transactions').select('date').eq('household_id', hh).order('date', { ascending: false }).limit(1),
    admin.from('notification_log').select('type, sent_at, payload').eq('user_id', userId).gte('sent_at', since),
    admin.from('month_starts').select('year_month, remind_monthly').eq('household_id', hh).order('year_month', { ascending: false }).limit(1),
  ]);

  const log = ((logRes.data ?? []) as LogEntry[]);
  const lastInactivity = log
    .filter((l) => l.type === 'inactivity')
    .map((l) => l.sent_at)
    .sort()
    .pop() ?? null;
  const lastStart = (startRes.data ?? [])[0] as { year_month: string; remind_monthly: boolean } | undefined;

  return {
    prefs: resolveAvisoPrefs(prefsRes.data),
    log,
    data: {
      today,
      nowMs,
      categories: (catsRes.data ?? []) as CtfCategory[],
      subs: (subsRes.data ?? []) as PlanSubItem[],
      incomes: (incRes.data ?? []) as PlanIncome[],
      caps: resolveCaps(capsRes.error ? null : capsRes.data),
      txs: (txRes.data ?? []) as AvisoData['txs'],
      lastTxDate: ((lastRes.data ?? [])[0] as { date?: string } | undefined)?.date ?? null,
      lastInactivityAt: lastInactivity,
      monthStartPending: !startRes.error && !!lastStart && lastStart.remind_monthly && lastStart.year_month !== month,
    },
  };
}
