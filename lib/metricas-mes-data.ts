// Consultas para lib/metricas-mes: movimientos con las columnas que
// necesita la clasificación y los intereses de los pagos a deudas.

import type { SupabaseClient } from '@supabase/supabase-js'
import { interesDelPago, type InteresesDeuda, type MetricasCategoria, type MetricasTx } from './metricas-mes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

/** Columnas de transactions que usa resumirMovimientos. */
export const METRICAS_TX_COLUMNS = 'id, amount, type, category_id, transaction_type, date'

const PAGE = 1000

/** Movimientos del hogar entre dos fechas, paginados (PostgREST corta en 1000). */
export async function loadMetricasTxs(supabase: Client, householdId: string, from: string, to: string): Promise<MetricasTx[]> {
  const rows: MetricasTx[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select(METRICAS_TX_COLUMNS)
      .eq('household_id', householdId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as MetricasTx[]))
    if (!data || data.length < PAGE) return rows
  }
}

/**
 * Intereses de los pagos a deudas marcados en Pagos del mes entre dos
 * fechas. Sin la tabla de pagos (migración vieja) devuelve un mapa vacío.
 */
export async function loadInteresesDeuda(supabase: Client, householdId: string, from: string, to: string): Promise<InteresesDeuda> {
  const { data, error } = await supabase
    .from('bill_payments')
    .select('transaction_id, debt_id, transactions(amount), debts(balance, interest_rate)')
    .eq('household_id', householdId)
    .not('debt_id', 'is', null)
    .not('transaction_id', 'is', null)
    .gte('month', `${from.slice(0, 7)}-01`)
    .lte('month', to)
  const out = new Map<string, number>()
  if (error || !data) return out
  type One<T> = T | T[] | null
  const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)
  for (const row of data as { transaction_id: string; transactions: One<{ amount: number | string }>; debts: One<{ balance: number | string; interest_rate: number | string }> }[]) {
    const tx = first(row.transactions)
    const debt = first(row.debts)
    out.set(row.transaction_id, debt && tx ? interesDelPago(Number(tx.amount), debt) : 0)
  }
  return out
}

/** Todo lo que necesita resumirMovimientos para un periodo. */
export async function loadMetricasInput(supabase: Client, householdId: string, from: string, to: string): Promise<{
  txs: MetricasTx[]
  categories: MetricasCategoria[]
  intereses: InteresesDeuda
}> {
  const [txs, catsRes, intereses] = await Promise.all([
    loadMetricasTxs(supabase, householdId, from, to),
    supabase.from('budget_categories').select('id, bucket, name').eq('household_id', householdId),
    loadInteresesDeuda(supabase, householdId, from, to),
  ])
  return { txs, categories: (catsRes.data ?? []) as MetricasCategoria[], intereses }
}
