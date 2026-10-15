// Meses manuales del historial de patrimonio (solo servidor, service role).
// El service role salta RLS: siempre se filtra por el usuario de la sesión.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ManualMonth } from './manual'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

/** Meses manuales del usuario. Sin la migración devuelve [] (la gráfica sigue igual). */
export async function loadManualMonths(admin: Admin, userId: string): Promise<ManualMonth[]> {
  const { data, error } = await admin
    .from('networth_manual_months')
    .select('month, assets, liabilities')
    .eq('user_id', userId)
    .order('month', { ascending: true })
  if (error || !data) return []
  return (data as { month: string; assets: number; liabilities: number }[]).map((r) => ({
    month: r.month,
    assets: Number(r.assets),
    liabilities: Number(r.liabilities),
  }))
}
