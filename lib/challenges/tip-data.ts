// Datos del tip contextual (solo servidor). Usa computeCategoryPace (Resumen
// v2) para decidir el Sobregiro; no reimplementa el cálculo.

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCategoryPace, type PaceMode } from '../resumen/pace'
import { getRecurringCharges } from '../recurring/data'
import { buildTip, savingsRows, tipKeyFor, type ContextualTip, type SavingsRow } from './tip'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface TipData {
  tip: ContextualTip | null
  rows: SavingsRow[]
  /** Plantillas sugeridas para "Aceptar reto". */
  templates: { noSpendId: string | null; reductionId: string | null }
}

export async function getCategoryTip(admin: Admin, hid: string, categoryId: string, today: string): Promise<TipData> {
  const month = today.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const ctx = { today: new Date(`${today}T12:00:00Z`), daysInMonth, dayOfMonth: Number(today.slice(8, 10)) }

  const [catsRes, txRes, dismissRes, activeRes, tplRes] = await Promise.all([
    admin.from('budget_categories').select('id, name, bucket, budgeted_amount, pace_mode, expected_day, archived_at').eq('household_id', hid).in('bucket', ['needs', 'wants']),
    admin.from('transactions').select('amount, category_id').eq('household_id', hid).eq('type', 'expense').eq('transaction_type', 'gasto').gte('date', `${month}-01`).lte('date', today),
    admin.from('contextual_tip_dismissals').select('tip_key').eq('household_id', hid).eq('period', month),
    admin.from('user_challenges').select('category_id').eq('household_id', hid).eq('status', 'active'),
    admin.from('challenge_templates').select('id, slug').in('slug', ['no_spend_category_14d', 'spend_reduction_30d']).eq('active', true),
  ])

  type Cat = { id: string; name: string; budgeted_amount: number | null; pace_mode: string | null; expected_day: number | null; archived_at: string | null }
  const cats = ((catsRes.data ?? []) as Cat[]).filter((c) => !c.archived_at)
  const txs = (txRes.data ?? []) as { amount: number; category_id: string | null }[]
  const spent = new Map<string, { sum: number; n: number }>()
  for (const t of txs) {
    if (!t.category_id) continue
    const s = spent.get(t.category_id) ?? { sum: 0, n: 0 }
    s.sum += Number(t.amount); s.n += 1
    spent.set(t.category_id, s)
  }

  const paces = cats.map((c) => computeCategoryPace({
    categoryId: c.id, name: c.name, budget: Number(c.budgeted_amount ?? 0), spent: spent.get(c.id)?.sum ?? 0,
    paceMode: (c.pace_mode === 'fixed' ? 'fixed' : 'linear') as PaceMode, expectedDay: c.expected_day,
  }, ctx))
  // Solo categorías con presupuesto: "sobre presupuesto" sin presupuesto no aplica.
  const over = paces.filter((p) => p.status === 'sobregiro' && p.budget > 0)
  const target = paces.find((p) => p.categoryId === categoryId)
  const dismissed = new Set(((dismissRes.data ?? []) as { tip_key: string }[]).map((d) => d.tip_key))
  const activeCats = new Set(((activeRes.data ?? []) as { category_id: string | null }[]).map((a) => a.category_id))

  const tip = target && target.budget > 0
    ? buildTip({
        category: { id: target.categoryId, name: target.name },
        status: target.status,
        purchases: spent.get(categoryId)?.n ?? 0,
        spent: target.spent,
        overBudget: target.overrun,
        dismissed: dismissed.has(tipKeyFor(categoryId)),
        activeChallengeInCategory: activeCats.has(categoryId),
      })
    : null

  let subs: number | null = null
  if (tip) {
    const rec = await getRecurringCharges(admin, hid, { today, remindersEnabled: false }).catch(() => null)
    subs = rec && rec.totals.activeCount > 0 ? rec.totals.monthlyTotal : null
  }

  const tpl = (tplRes.data ?? []) as { id: string; slug: string }[]
  return {
    tip,
    rows: tip ? savingsRows(over.map((p) => ({ id: p.categoryId, name: p.name, overrun: p.overrun })), subs) : [],
    templates: {
      noSpendId: tpl.find((t) => t.slug === 'no_spend_category_14d')?.id ?? null,
      reductionId: tpl.find((t) => t.slug === 'spend_reduction_30d')?.id ?? null,
    },
  }
}
