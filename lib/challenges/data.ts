// Capa de datos de retos (solo servidor, service role). El progreso se
// calcula al leer; al terminar un reto se guarda su resultado (historial).

import type { SupabaseClient } from '@supabase/supabase-js'
import { baselineDaily, computeProgress, endsAt, type ChallengeProgress, type ChallengeType, type ProgressTx } from './progress'
import { challengeTitle, type TemplateRow } from './rules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface ChallengeView {
  id: string
  templateId: string
  slug: string
  type: ChallengeType
  title: string
  description: string
  healthComponent: string | null
  categoryId: string | null
  categoryName: string | null
  targetAmount: number | null
  startedAt: string
  endsAt: string
  status: 'active' | 'completed' | 'abandoned'
  progress: ChallengeProgress
}

export interface TemplateView {
  id: string
  slug: string
  type: ChallengeType
  title: string
  description: string
  durationDays: number
  healthComponent: string | null
  requiresCategory: boolean
  suggestedCategoryId: string | null
}

export interface ChallengesData {
  active: ChallengeView[]
  /** Terminados hace poco (para la pantalla de cierre) y el historial. */
  history: ChallengeView[]
  templates: TemplateView[]
  categories: { id: string; name: string }[]
}

type Row = {
  id: string; template_id: string; status: 'active' | 'completed' | 'abandoned'; category_id: string | null
  baseline_daily: number | null; target_amount: number | null; started_at: string; ends_at: string
  result: { daysMet?: number; estimatedSavings?: number | null; reviewed?: boolean; completedDays?: boolean[] } | null
}

type FullTemplate = TemplateRow & { description: string; health_component: string | null }

const PAGE = 1000

/** Movimientos (todos los tipos) desde `from`, para progreso y registro. */
export async function loadProgressTxs(admin: Admin, hid: string, from: string, to: string): Promise<ProgressTx[]> {
  const out: ProgressTx[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .from('transactions')
      .select('id, date, amount, category_id, type, transaction_type')
      .eq('household_id', hid)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error('No se pudieron leer los movimientos')
    for (const t of (data ?? []) as { date: string; amount: number; category_id: string | null; type: string; transaction_type: string | null }[]) {
      out.push({ date: t.date, amount: Number(t.amount), categoryId: t.category_id, isExpense: t.type === 'expense' && (t.transaction_type ?? 'gasto') === 'gasto' })
    }
    if (!data || data.length < PAGE) return out
  }
}

export async function spendCategories(admin: Admin, hid: string): Promise<{ id: string; name: string }[]> {
  const { data } = await admin
    .from('budget_categories')
    .select('id, name, bucket, archived_at')
    .eq('household_id', hid)
    .in('bucket', ['needs', 'wants'])
    .order('name')
  return ((data ?? []) as { id: string; name: string; archived_at: string | null }[]).filter((c) => !c.archived_at).map((c) => ({ id: c.id, name: c.name }))
}

export async function loadTemplates(admin: Admin): Promise<FullTemplate[]> {
  const { data } = await admin.from('challenge_templates').select('*').order('duration_days', { ascending: true })
  return (data ?? []) as FullTemplate[]
}

/** ¿El hogar revisó sus suscripciones desde que empezó el reto? */
async function reviewedSubscriptions(admin: Admin, hid: string, since: string): Promise<boolean> {
  const { data } = await admin.from('recurring_overrides').select('id').eq('household_id', hid).gte('updated_at', `${since}T00:00:00`).limit(1)
  return !!data && data.length > 0
}

export async function getChallenges(admin: Admin, hid: string, today: string): Promise<ChallengesData> {
  const [templates, categories, rowsRes] = await Promise.all([
    loadTemplates(admin),
    spendCategories(admin, hid),
    admin.from('user_challenges').select('*').eq('household_id', hid).order('started_at', { ascending: false }).limit(60),
  ])
  const rows = (rowsRes.data ?? []) as Row[]
  const tplById = new Map(templates.map((t) => [t.id, t]))
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const activeRows = rows.filter((r) => r.status === 'active')
  const from = activeRows.reduce((m, r) => (r.started_at < m ? r.started_at : m), today)
  const txs = activeRows.length ? await loadProgressTxs(admin, hid, from, today) : []

  const view = (r: Row, progress: ChallengeProgress): ChallengeView => {
    const t = tplById.get(r.template_id)
    const name = r.category_id ? catName.get(r.category_id) ?? null : null
    return {
      id: r.id, templateId: r.template_id, slug: t?.slug ?? '', type: (t?.type ?? 'logging_streak') as ChallengeType,
      title: challengeTitle(t?.title ?? 'Reto', name), description: challengeTitle(t?.description ?? '', name),
      healthComponent: t?.health_component ?? null, categoryId: r.category_id, categoryName: name,
      targetAmount: r.target_amount === null ? null : Number(r.target_amount),
      startedAt: r.started_at, endsAt: r.ends_at, status: r.status, progress,
    }
  }

  const active: ChallengeView[] = []
  const history: ChallengeView[] = []
  for (const r of rows) {
    const t = tplById.get(r.template_id)
    const duration = t?.duration_days ?? Math.max(1, Math.round((Date.parse(r.ends_at) - Date.parse(r.started_at)) / 86_400_000) + 1)
    if (r.status !== 'active') {
      const res = r.result ?? {}
      history.push(view(r, {
        dayIndex: duration, durationDays: duration, completedDays: res.completedDays ?? [], streak: 0,
        estimatedSavings: res.estimatedSavings ?? null, status: 'completed', daysMet: res.daysMet ?? 0,
      }))
      continue
    }
    const type = (t?.type ?? 'logging_streak') as ChallengeType
    const reviewDone = type === 'review_subscriptions' ? (r.result?.reviewed || (await reviewedSubscriptions(admin, hid, r.started_at))) : false
    const progress = computeProgress(
      { type, startedAt: r.started_at, durationDays: duration, categoryId: r.category_id, baselineDaily: r.baseline_daily === null ? null : Number(r.baseline_daily) },
      txs, today, { reviewDone },
    )
    if (progress.status === 'completed') {
      // Cierre: se guarda el resultado y pasa al historial.
      const result = { daysMet: progress.daysMet, estimatedSavings: progress.estimatedSavings, completedDays: progress.completedDays, reviewed: reviewDone || undefined }
      await admin.from('user_challenges').update({ status: 'completed', result, updated_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'active')
      history.unshift(view({ ...r, status: 'completed', result }, progress))
    } else {
      active.push(view(r, progress))
    }
  }

  const tplViews: TemplateView[] = templates
    .filter((t) => t.active)
    .map((t) => {
      const suggested = t.default_config?.suggested_category
      const match = suggested ? categories.find((c) => c.name.toLowerCase() === suggested.toLowerCase()) : undefined
      return {
        id: t.id, slug: t.slug, type: t.type as ChallengeType, title: t.title, description: t.description,
        durationDays: t.duration_days, healthComponent: t.health_component, requiresCategory: !!t.default_config?.requires_category,
        suggestedCategoryId: match?.id ?? null,
      }
    })

  return { active, history, templates: tplViews, categories }
}

/** Línea base al iniciar (3 meses completos antes del mes de inicio). */
export async function computeStartBaseline(admin: Admin, hid: string, categoryId: string, startedAt: string): Promise<number | null> {
  const [{ data: first }] = await Promise.all([
    admin.from('transactions').select('date').eq('household_id', hid).order('date', { ascending: true }).limit(1),
  ])
  const earliest = (first?.[0]?.date as string | undefined)?.slice(0, 7) ?? null
  const [y, m] = startedAt.slice(0, 7).split('-').map(Number)
  const back = new Date(Date.UTC(y, m - 4, 1)).toISOString().slice(0, 10)
  const txs = await loadProgressTxs(admin, hid, back, startedAt)
  return baselineDaily(txs, categoryId, startedAt, earliest)
}

export { endsAt }
