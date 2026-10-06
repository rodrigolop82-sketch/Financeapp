// Datos vivos de la salud financiera: Plan del mes, movimientos, metas y
// deudas. buildScoreInput es puro (se prueba con vitest); loadScoreInput
// hace las consultas.

import type { SupabaseClient } from '@supabase/supabase-js'
import { planSummary, type PlanCategory, type PlanIncome, type PlanSubItem } from './plan-del-mes'
import { monthRange } from './movimientos'
import type { IncomeType, ScoreInput } from './score-calculator'

export interface ScoreRaw {
  month: string
  profile: {
    total_income: number | string | null
    total_fixed_expenses: number | string | null
    total_savings: number | string | null
    income_type: IncomeType | null
  } | null
  categories: (PlanCategory & { archived_at?: string | null })[]
  subItems: PlanSubItem[]
  incomes: PlanIncome[]
  /** Movimientos del mes y de los 3 anteriores. */
  txs: { amount: number | string; type: 'expense' | 'income'; category_id: string | null; date: string }[]
  /** Aportes a metas hechos en el mes. */
  contributions: number
  emergencyGoal: { id: string; current_amount: number | string } | null
  debts: { min_payment: number | string }[]
}

function prevMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Variación (desviación ÷ promedio) de los ingresos de los 3 meses anteriores. */
export function incomeVariation(txs: ScoreRaw['txs'], month: string): number | null {
  const months = [1, 2, 3].map((n) => prevMonth(month, n))
  const sums = months.map((m) => txs
    .filter((t) => t.type === 'income' && t.date.startsWith(m))
    .reduce((s, t) => s + Number(t.amount), 0))
    .filter((v) => v > 0)
  if (sums.length < 2) return null
  const mean = sums.reduce((a, b) => a + b, 0) / sums.length
  const sd = Math.sqrt(sums.reduce((a, v) => a + (v - mean) ** 2, 0) / sums.length)
  return mean > 0 ? sd / mean : null
}

export function buildScoreInput(raw: ScoreRaw): ScoreInput {
  const num = (v: number | string | null | undefined) => Number(v) || 0
  const cats = raw.categories.filter((c) => !c.archived_at)
  const plan = planSummary(cats, raw.subItems, raw.incomes)
  const bucketOf = new Map(cats.map((c) => [c.id, c.bucket]))
  const inMonth = raw.txs.filter((t) => t.date.startsWith(raw.month))
  const expenses = inMonth.filter((t) => t.type === 'expense')
  const savedInCategories = expenses
    .filter((t) => t.category_id && bucketOf.get(t.category_id) === 'savings')
    .reduce((s, t) => s + num(t.amount), 0)
  const spent = expenses
    .filter((t) => !(t.category_id && bucketOf.get(t.category_id) === 'savings'))
    .reduce((s, t) => s + num(t.amount), 0)

  return {
    income: plan.income > 0 ? plan.income : num(raw.profile?.total_income),
    saved: raw.contributions + savedInCategories,
    debtPayments: raw.debts.reduce((s, d) => s + num(d.min_payment), 0),
    emergencyFund: raw.emergencyGoal ? num(raw.emergencyGoal.current_amount) : num(raw.profile?.total_savings),
    fixedExpenses: plan.fixed > 0 ? plan.fixed : num(raw.profile?.total_fixed_expenses),
    spent,
    planned: plan.needs + plan.wants,
    incomeType: raw.profile?.income_type ?? 'fixed',
    incomeVariation: incomeVariation(raw.txs, raw.month),
    emergencyGoalId: raw.emergencyGoal?.id ?? null,
    hasDebts: raw.debts.length > 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export async function loadScoreInput(
  supabase: Client,
  { householdId, userId, month }: { householdId: string; userId: string; month: string },
): Promise<{ input: ScoreInput; raw: ScoreRaw }> {
  const { from, to } = monthRange(month)
  const since = monthRange(prevMonth(month, 3)).from
  const [profileRes, catsRes, subsRes, incomesRes, txRes, goalsRes, debtsRes] = await Promise.all([
    supabase.from('financial_profiles')
      .select('total_income, total_fixed_expenses, total_savings, income_type')
      .eq('household_id', householdId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('budget_categories').select('*').eq('household_id', householdId),
    supabase.from('budget_sub_items').select('*').eq('household_id', householdId),
    supabase.from('income_entries').select('*').eq('household_id', householdId),
    supabase.from('transactions').select('amount, type, category_id, date')
      .eq('household_id', householdId).gte('date', since).lte('date', to),
    supabase.from('financial_goals').select('id, goal_type, status, current_amount, created_at').eq('user_id', userId),
    supabase.from('debts').select('min_payment').eq('household_id', householdId).eq('is_paid', false),
  ])

  const goals = (goalsRes.data ?? []) as { id: string; goal_type: string; status: string; current_amount: number }[]
  const emergencyGoal = goals.find((g) => g.goal_type === 'emergency_fund' && g.status !== 'paused') ?? null

  let contributions = 0
  if (goals.length > 0) {
    const { data } = await supabase.from('goal_contributions').select('amount')
      .in('goal_id', goals.map((g) => g.id))
      .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
    contributions = (data ?? []).reduce((s: number, c: { amount: number | string }) => s + Number(c.amount), 0)
  }

  const raw: ScoreRaw = {
    month,
    profile: profileRes.data ?? null,
    categories: (catsRes.data ?? []) as ScoreRaw['categories'],
    subItems: (subsRes.data ?? []) as PlanSubItem[],
    incomes: (incomesRes.data ?? []) as PlanIncome[],
    txs: (txRes.data ?? []) as ScoreRaw['txs'],
    contributions,
    emergencyGoal: emergencyGoal ? { id: emergencyGoal.id, current_amount: emergencyGoal.current_amount } : null,
    debts: (debtsRes.data ?? []) as ScoreRaw['debts'],
  }
  return { input: buildScoreInput(raw), raw }
}

export interface ScoreHistoryPoint {
  /** 'YYYY-MM'. */
  month: string
  score: number
}

/** Puntajes guardados al cerrar cada mes (los últimos `limit`). */
export async function loadScoreHistory(supabase: Client, householdId: string, limit = 6): Promise<ScoreHistoryPoint[]> {
  const { data } = await supabase.from('monthly_snapshots').select('month, health_score')
    .eq('household_id', householdId).order('month', { ascending: false }).limit(limit)
  return ((data ?? []) as { month: string; health_score: number | null }[])
    .filter((s) => s.health_score != null)
    .map((s) => ({ month: s.month.slice(0, 7), score: Number(s.health_score) }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/** Guarda el puntaje del mes (al cerrarlo). */
export async function saveMonthScore(supabase: Client, householdId: string, month: string, score: number) {
  return supabase.from('monthly_snapshots').upsert(
    { household_id: householdId, month: `${month}-01`, health_score: score },
    { onConflict: 'household_id,month' },
  )
}
