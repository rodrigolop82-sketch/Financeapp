// Capa de datos de suscripciones (solo servidor, service role). Carga los
// gastos del hogar, corre el detector puro y aplica lo que decidió el hogar
// (recurring_overrides) y el catálogo de "cómo cancelar".

import type { SupabaseClient } from '@supabase/supabase-js'
import { categoryCapKeys, type CapCategory } from '../recomendaciones'
import {
  averageCompleteMonthSpending,
  detectRecurringCharges,
  matchCancelInfo,
  recurringTotals,
  type CancelInfoRow,
  type RecurringCharge,
  type RecurringTotals,
  type RecurringTxInput,
} from './detect'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface CancelInfo {
  displayName: string
  cancelUrl: string | null
  cancelEmail: string | null
  steps: string[]
  notes: string | null
}

export interface RecurringChargeView extends RecurringCharge {
  categoryName: string | null
  cancelInfo: CancelInfo | null
  /** Recordatorio guardado (solo si el hogar tiene la función Premium). */
  remindDaysBefore: 1 | 2 | 3 | null
}

export interface RecurringData {
  today: string
  charges: RecurringChargeView[]
  totals: RecurringTotals
  /** ≈ % del gasto mensual (promedio de 3 meses completos). null si no aplica. */
  pctOfSpending: number | null
}

const PAGE = 1000

/** Primer día del mes `n` meses antes de `today`. */
export function monthsBackStart(today: string, n: number): string {
  let [y, m] = today.slice(0, 7).split('-').map(Number)
  m -= n
  while (m < 1) { m += 12; y -= 1 }
  return `${y}-${String(m).padStart(2, '0')}-01`
}

interface TxRow { id: string; date: string; amount: number; description: string | null; category_id: string | null }

async function loadExpenses(admin: Admin, householdId: string, from: string, to: string): Promise<TxRow[]> {
  const rows: TxRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .from('transactions')
      .select('id, date, amount, description, category_id')
      .eq('household_id', householdId)
      .eq('type', 'expense')
      .eq('transaction_type', 'gasto')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error('No se pudieron leer los movimientos')
    rows.push(...((data ?? []) as TxRow[]))
    if (!data || data.length < PAGE) return rows
  }
}

/** Categorías que no son suscripciones: vivienda, deudas y ahorro. */
export function excludedCategoryIds(categories: (CapCategory & { bucket: string })[]): string[] {
  const caps = categoryCapKeys(categories)
  return categories
    .filter((c) => c.bucket === 'savings' || c.bucket === 'income' || caps[c.id] === 'vivienda' || caps[c.id] === 'deudas')
    .map((c) => c.id)
}

export async function getRecurringCharges(
  admin: Admin,
  householdId: string,
  opts: { today: string; remindersEnabled: boolean },
): Promise<RecurringData> {
  const { today } = opts
  const from = monthsBackStart(today, 6)

  const [txs, catsRes, overridesRes, debtPaysRes, infoRes, earliestRes] = await Promise.all([
    loadExpenses(admin, householdId, from, today),
    admin.from('budget_categories').select('id, name, bucket, cap_key, parent_category_id').eq('household_id', householdId),
    admin.from('recurring_overrides').select('merchant_key, status, remind_days_before').eq('household_id', householdId),
    admin.from('bill_payments').select('transaction_id').eq('household_id', householdId).not('debt_id', 'is', null).not('transaction_id', 'is', null),
    admin.from('merchant_cancel_info').select('merchant_key, display_name, match_patterns, cancel_url, cancel_email, steps, notes'),
    admin.from('transactions').select('date').eq('household_id', householdId).order('date', { ascending: true }).limit(1),
  ])

  const categories = (catsRes.data ?? []) as (CapCategory & { bucket: string })[]
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const overrides = (overridesRes.data ?? []) as { merchant_key: string; status: string | null; remind_days_before: number | null }[]
  const excludeKeys = overrides.filter((o) => o.status === 'dismissed' || o.status === 'cancelled_by_user').map((o) => o.merchant_key)
  const reminders = new Map(overrides.filter((o) => o.remind_days_before).map((o) => [o.merchant_key, o.remind_days_before as 1 | 2 | 3]))
  const infoRows = (infoRes.data ?? []) as CancelInfoRow[]

  const input: RecurringTxInput[] = txs.map((t) => ({
    id: t.id, date: t.date, amount: Number(t.amount), description: t.description, categoryId: t.category_id,
  }))
  const detected = detectRecurringCharges(input, {
    today,
    excludeKeys,
    excludeCategoryIds: excludedCategoryIds(categories),
    excludeTransactionIds: ((debtPaysRes.data ?? []) as { transaction_id: string }[]).map((r) => r.transaction_id),
  })

  const charges: RecurringChargeView[] = detected.map((c) => {
    const info = matchCancelInfo(c.merchantKey, infoRows)
    return {
      ...c,
      displayName: info?.display_name ?? c.displayName,
      categoryName: c.categoryId ? catName.get(c.categoryId) ?? null : null,
      cancelInfo: info
        ? { displayName: info.display_name, cancelUrl: info.cancel_url, cancelEmail: info.cancel_email, steps: info.steps ?? [], notes: info.notes }
        : null,
      remindDaysBefore: opts.remindersEnabled ? reminders.get(c.merchantKey) ?? null : null,
    }
  })

  const totals = recurringTotals(detected, today)
  const monthTotals: Record<string, number> = {}
  for (const t of txs) monthTotals[t.date.slice(0, 7)] = (monthTotals[t.date.slice(0, 7)] ?? 0) + Number(t.amount)
  const earliest = (earliestRes.data?.[0]?.date as string | undefined)?.slice(0, 7) ?? null
  const avg = averageCompleteMonthSpending(monthTotals, today, earliest)
  const pctOfSpending = avg && avg > 0 && totals.monthlyTotal > 0 ? Math.round((totals.monthlyTotal / avg) * 100) : null

  return { today, charges, totals, pctOfSpending }
}
