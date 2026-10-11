// Capa de datos del resumen semanal (solo servidor, service role).
// Los números se calculan al momento; weekly_snapshots solo guarda el
// comentario de IA (con su huella) y si la semana ya se vio.

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { localMonth } from '../dates'
import { generateSnapshotCommentary } from './ai'
import { snapshotDataKey } from './prompt'
import {
  addDays, averagePreviousWeeks, computeWeeklySnapshot, lastCompleteWeekStart, mondayOf,
  type SnapshotCategory, type SnapshotTx, type WeeklySnapshot,
} from './weekly'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface SuggestedSaving {
  goalId: string
  goalName: string
  amount: number
}

export interface SnapshotView {
  snapshot: WeeklySnapshot
  /** Promedio de las 4 semanas completas anteriores (cuando no hay presupuesto). */
  avgPrevWeeks: number | null
  /** Primera y última semana navegables. */
  firstWeek: string
  latestWeek: string
  /** Premium: comentario de IA validado (null ⇒ observación determinista). */
  aiCommentary: string | null
  /** Premium: "Ahorrar Q x" hacia la meta principal. */
  suggestedSaving: SuggestedSaving | null
}

const PAGE = 1000

async function loadExpenses(admin: Admin, hid: string, from: string, to: string): Promise<SnapshotTx[]> {
  const rows: SnapshotTx[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .from('transactions')
      .select('id, date, amount, category_id')
      .eq('household_id', hid)
      .eq('type', 'expense')
      .eq('transaction_type', 'gasto')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error('No se pudieron leer los movimientos')
    for (const t of (data ?? []) as { date: string; amount: number; category_id: string | null }[]) {
      rows.push({ date: t.date, amount: Number(t.amount), categoryId: t.category_id })
    }
    if (!data || data.length < PAGE) return rows
  }
}

/** Primera semana completa con movimientos (null si aún no hay ninguna). */
export async function weekBounds(admin: Admin, hid: string, today: string): Promise<{ first: string; latest: string } | null> {
  const { data } = await admin.from('transactions').select('date').eq('household_id', hid).order('date', { ascending: true }).limit(1)
  const earliest = data?.[0]?.date as string | undefined
  const latest = lastCompleteWeekStart(today)
  if (!earliest) return null
  const first = mondayOf(earliest)
  return first <= latest ? { first, latest } : null
}

/** Meta principal (la activa más avanzada sin completar), como en Inicio. */
async function mainGoal(admin: Admin, hid: string, userId: string): Promise<{ id: string; name: string } | null> {
  const { data } = await admin
    .from('financial_goals')
    .select('id, name, status, current_amount, target_amount, user_id, household_id, shared')
    .or(`user_id.eq.${userId},and(household_id.eq.${hid},shared.eq.true)`)
  type G = { id: string; name: string; status: string; current_amount: number; target_amount: number }
  const ratio = (g: G) => (Number(g.target_amount) > 0 ? Number(g.current_amount) / Number(g.target_amount) : 0)
  const best = ((data ?? []) as G[]).filter((g) => g.status === 'active' && ratio(g) < 1).sort((a, b) => ratio(b) - ratio(a))[0]
  return best ? { id: best.id, name: best.name } : null
}

export async function loadWeeklySnapshot(
  admin: Admin,
  hid: string,
  weekStart: string,
): Promise<{ snapshot: WeeklySnapshot; avgPrevWeeks: number | null }> {
  const from = addDays(weekStart, -28)
  const to = addDays(weekStart, 6)
  const months = Array.from(new Set([weekStart.slice(0, 7), to.slice(0, 7)]))
  const currentMonth = localMonth()

  const [txs, catsRes, snapsRes] = await Promise.all([
    loadExpenses(admin, hid, from, to),
    admin.from('budget_categories').select('id, name, bucket, pace_mode, budgeted_amount').eq('household_id', hid),
    admin.from('budget_snapshots').select('category_id, month, amount').eq('household_id', hid).in('month', months.map((m) => `${m}-01`)),
  ])

  type Cat = { id: string; name: string; bucket: string; pace_mode: string | null; budgeted_amount: number | null }
  const rawCats = (catsRes.data ?? []) as Cat[]
  const spendCats = rawCats.filter((c) => c.bucket === 'needs' || c.bucket === 'wants')
  const categories: SnapshotCategory[] = spendCats.map((c) => ({ id: c.id, name: c.name, fixed: c.pace_mode === 'fixed' }))

  // Plan de cada mes: el guardado al cerrar el mes si existe; si no, el vigente.
  const snaps = (snapsRes.data ?? []) as { category_id: string; month: string; amount: number }[]
  const budgets: Record<string, Record<string, number>> = {}
  for (const m of months) {
    const closed = snaps.filter((s) => s.month.slice(0, 7) === m)
    budgets[m] = {}
    if (closed.length > 0 && m < currentMonth) {
      for (const s of closed) budgets[m][s.category_id] = Number(s.amount)
    } else {
      for (const c of spendCats) budgets[m][c.id] = Number(c.budgeted_amount ?? 0)
    }
  }

  const spendIds = new Set(spendCats.map((c) => c.id))
  // Movimientos de categorías de ahorro/ingreso no son gasto semanal.
  const savingIds = new Set(rawCats.filter((c) => !spendIds.has(c.id)).map((c) => c.id))
  const relevant = txs.filter((t) => !(t.categoryId && savingIds.has(t.categoryId)))

  const snapshot = computeWeeklySnapshot({ weekStart, txs: relevant, categories, budgets })
  return { snapshot, avgPrevWeeks: averagePreviousWeeks(relevant, categories, weekStart) }
}

export function dataHash(s: WeeklySnapshot): string {
  return createHash('sha256').update(snapshotDataKey(s)).digest('hex').slice(0, 32)
}

/**
 * Comentario de IA en caché por (hogar, semana); se regenera solo si cambian
 * los datos. Solo para hogares con `snapshot.ai_commentary` (quien llama lo
 * verifica).
 */
async function cachedCommentary(admin: Admin, hid: string, s: WeeklySnapshot): Promise<string | null> {
  if (s.isSparse) return null
  const hash = dataHash(s)
  const { data: row } = await admin
    .from('weekly_snapshots')
    .select('ai_commentary, data_hash')
    .eq('household_id', hid)
    .eq('week_start', s.weekStart)
    .maybeSingle()
  if (row?.ai_commentary && row.data_hash === hash) return row.ai_commentary as string
  const text = await generateSnapshotCommentary(s)
  if (text) {
    await admin.from('weekly_snapshots').upsert(
      { household_id: hid, week_start: s.weekStart, ai_commentary: text, data_hash: hash, ai_generated_at: new Date().toISOString() },
      { onConflict: 'household_id,week_start' },
    )
  }
  return text
}

export async function getWeeklySnapshot(
  admin: Admin,
  opts: { householdId: string; userId: string; weekStart: string; bounds: { first: string; latest: string }; premium: boolean },
): Promise<SnapshotView> {
  const { householdId: hid } = opts
  const { snapshot, avgPrevWeeks } = await loadWeeklySnapshot(admin, hid, opts.weekStart)
  let aiCommentary: string | null = null
  let suggestedSaving: SuggestedSaving | null = null
  if (opts.premium) {
    aiCommentary = await cachedCommentary(admin, hid, snapshot).catch(() => null)
    if (snapshot.surplusVsExpected && snapshot.surplusVsExpected > 0) {
      const goal = await mainGoal(admin, hid, opts.userId).catch(() => null)
      if (goal) suggestedSaving = { goalId: goal.id, goalName: goal.name, amount: Math.floor(snapshot.surplusVsExpected) }
    }
  }
  return { snapshot, avgPrevWeeks, firstWeek: opts.bounds.first, latestWeek: opts.bounds.latest, aiCommentary, suggestedSaving }
}

/** Marca la semana más reciente como vista (para la tarjeta de Inicio). */
export async function markViewed(admin: Admin, hid: string, weekStart: string): Promise<void> {
  const { data: row } = await admin.from('weekly_snapshots').select('id, viewed_at').eq('household_id', hid).eq('week_start', weekStart).maybeSingle()
  if (row?.viewed_at) return
  if (row) await admin.from('weekly_snapshots').update({ viewed_at: new Date().toISOString() }).eq('id', row.id)
  else await admin.from('weekly_snapshots').insert({ household_id: hid, week_start: weekStart, viewed_at: new Date().toISOString() })
}
