// Capa de datos de Mis cuentas y patrimonio (solo servidor, service role).
// Como el service role salta RLS, aquí se filtra lo mismo que RLS: cuentas
// del hogar que son propias o compartidas. Los saldos son datos sensibles:
// nunca van a logs, mensajes de error ni URLs. Sí van al contexto de
// Pregúntale a Zafi (lib/ai-context.ts), con el mismo filtro de visibilidad,
// para que pueda aconsejar con el patrimonio real de la persona.

import type { SupabaseClient } from '@supabase/supabase-js'
import { daysSince, isStale, monthlyHistory, summarize, type BalancePoint, type HistoryPoint, type NetWorthItem, type NetWorthSummary } from './compute'
import { canSeeSource, type SourceKind } from './sources'
import type { DebtPurpose, DebtTerms } from './groups'
import { amortizar } from '@/lib/amortizacion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface DebtRef {
  id: string
  name: string
  balance: number
}

export interface SourceView {
  id: string
  kind: SourceKind
  side: 'asset' | 'liability'
  name: string
  institution: string | null
  /** null = sin saldo (no cuenta en el patrimonio). */
  balance: number | null
  /** Días desde la última actualización (null sin saldo o en deudas). */
  daysSinceUpdate: number | null
  stale: boolean
  /** Deuda del módulo Deudas: se edita allá. */
  fromDebts: boolean
  mine: boolean
  shared: boolean
  tracksStatements: boolean
  last4: string | null
  detected: boolean
  /** Tarjeta vinculada a su deuda de Plan › Deudas. */
  debt: DebtRef | null
  /** Tasa, pago y plazo de una deuda de Plan › Deudas (null en las demás). */
  debtTerms: DebtTerms | null
}

export interface NetWorthData {
  summary: NetWorthSummary
  /** Para Mi patrimonio: activos (con o sin saldo) y pasivos (otras deudas + Deudas). */
  assets: SourceView[]
  liabilities: SourceView[]
  /** Para Mis cuentas: todas las cuentas visibles, sin archivar. */
  accounts: SourceView[]
  /** Deudas activas del hogar, para vincular tarjetas. */
  debts: DebtRef[]
  hasSources: boolean
}

export type SourceRow = {
  id: string; household_id: string; kind: SourceKind; side: 'asset' | 'liability'; name: string; institution: string | null
  current_balance: number | null; balance_updated_at: string | null; archived_at: string | null
  owner_user_id: string | null; shared: boolean; tracks_statements: boolean; last4: string | null
  detection_method: string; debt_id: string | null
}
type DebtRow = {
  id: string; name: string; type: string; balance: number; is_paid: boolean | null
  interest_rate: number | null; min_payment: number | null; due_day: number | null
  original_amount: number | null; purpose: DebtPurpose | null
}

export const SOURCE_COLUMNS =
  'id, household_id, kind, side, name, institution, current_balance, balance_updated_at, archived_at, owner_user_id, shared, tracks_statements, last4, detection_method, debt_id'

/** Cuentas del hogar que el usuario puede ver (propias o compartidas). */
export async function visibleSources(admin: Admin, hid: string, userId: string): Promise<SourceRow[]> {
  const { data, error } = await admin.from('financial_sources').select(SOURCE_COLUMNS).eq('household_id', hid)
  if (error) throw new Error('No se pudieron leer tus cuentas')
  return ((data ?? []) as SourceRow[]).filter((s) => canSeeSource(s, userId))
}

/** Una cuenta, si el usuario puede verla. */
export async function getVisibleSource(admin: Admin, hid: string, userId: string, id: string): Promise<SourceRow | null> {
  const { data } = await admin.from('financial_sources').select(SOURCE_COLUMNS).eq('id', id).eq('household_id', hid).maybeSingle()
  const row = data as SourceRow | null
  return row && canSeeSource(row, userId) ? row : null
}

async function load(admin: Admin, hid: string, userId: string) {
  const sources = await visibleSources(admin, hid, userId)
  const ids = sources.map((s) => s.id)
  const [snapRes, debtRes, debtSnapRes] = await Promise.all([
    ids.length
      ? admin.from('source_balance_snapshots').select('source_id, balance, recorded_at').in('source_id', ids).order('recorded_at', { ascending: true }).limit(5000)
      : Promise.resolve({ data: [] }),
    admin.from('debts').select('id, name, type, balance, is_paid, interest_rate, min_payment, due_day, original_amount, purpose').eq('household_id', hid),
    admin.from('debt_balance_snapshots').select('debt_id, balance, recorded_at').eq('household_id', hid).order('recorded_at', { ascending: true }).limit(5000),
  ])
  const debts = (debtRes.data ?? []) as DebtRow[]

  // Patrimonio: solo cuentas con saldo (las tarjetas cuentan por su deuda).
  const items: NetWorthItem[] = [
    ...sources
      .filter((s) => s.current_balance !== null && s.kind !== 'credit_card')
      .map((s) => ({ id: s.id, side: s.side, currentBalance: Number(s.current_balance), balanceUpdatedAt: s.balance_updated_at, archivedAt: s.archived_at })),
    // Deudas pagadas valen 0 (no se "archivan": su historial sigue contando).
    ...debts.map((d) => ({ id: `debt:${d.id}`, side: 'liability' as const, currentBalance: d.is_paid ? 0 : Math.max(0, Number(d.balance)), balanceUpdatedAt: null, archivedAt: null })),
  ]
  const points: BalancePoint[] = [
    ...((snapRes.data ?? []) as { source_id: string; balance: number; recorded_at: string }[]).map((p) => ({ itemId: p.source_id, balance: Number(p.balance), recordedAt: p.recorded_at })),
    ...((debtSnapRes.data ?? []) as { debt_id: string; balance: number; recorded_at: string }[]).map((p) => ({ itemId: `debt:${p.debt_id}`, balance: Math.max(0, Number(p.balance)), recordedAt: p.recorded_at })),
  ]
  return { sources, debts, items, points }
}

function debtTerms(d: DebtRow): DebtTerms {
  const interestRate = Number(d.interest_rate) || 0
  const monthlyPayment = Number(d.min_payment) || 0
  const a = amortizar({ saldo: Math.max(0, Number(d.balance)), tasaAnual: interestRate, cuota: monthlyPayment })
  return {
    debtType: d.type === 'loan' ? 'loan' : d.type === 'informal' ? 'informal' : 'credit',
    purpose: d.purpose ?? null,
    interestRate,
    monthlyPayment,
    dueDay: d.due_day ?? null,
    originalAmount: d.original_amount === null || d.original_amount === undefined ? null : Number(d.original_amount),
    monthsLeft: a.ok ? a.meses : null,
  }
}

export async function getNetWorth(admin: Admin, hid: string, userId: string, nowIso: string): Promise<NetWorthData> {
  const { sources, debts, items, points } = await load(admin, hid, userId)
  const summary = summarize(items, points, nowIso)
  const activeDebts: DebtRef[] = debts
    .filter((d) => !d.is_paid && Number(d.balance) > 0)
    .map((d) => ({ id: d.id, name: d.name, balance: Number(d.balance) }))
  const debtById = new Map(activeDebts.map((d) => [d.id, d]))

  const accounts: SourceView[] = sources.filter((s) => !s.archived_at).map((s) => {
    const it = items.find((i) => i.id === s.id)
    return {
      id: s.id, kind: s.kind, side: s.side, name: s.name, institution: s.institution,
      balance: s.current_balance === null ? null : Number(s.current_balance),
      daysSinceUpdate: s.balance_updated_at ? daysSince(s.balance_updated_at, nowIso) : null,
      stale: !!it && isStale(it, nowIso),
      fromDebts: false, mine: s.owner_user_id === userId, shared: s.shared, tracksStatements: s.tracks_statements,
      last4: s.last4, detected: s.detection_method === 'auto',
      debt: s.debt_id ? debtById.get(s.debt_id) ?? null : null,
      debtTerms: null,
    }
  })
  const debtViews: SourceView[] = activeDebts.map((d) => {
    const raw = debts.find((x) => x.id === d.id)!
    return {
      id: `debt:${d.id}`, kind: raw.type === 'loan' ? 'loan' : raw.type === 'credit' ? 'credit_card' : 'other_liability',
      side: 'liability', name: d.name, institution: null, balance: d.balance, daysSinceUpdate: null, stale: false, fromDebts: true,
      mine: false, shared: true, tracksStatements: false, last4: null, detected: false, debt: null,
      debtTerms: debtTerms(raw),
    }
  })
  const byBalance = (a: SourceView, b: SourceView) => (b.balance ?? -1) - (a.balance ?? -1)
  return {
    summary,
    assets: accounts.filter((v) => v.side === 'asset').sort(byBalance),
    liabilities: [...accounts.filter((v) => v.side === 'liability' && v.kind !== 'credit_card'), ...debtViews].sort(byBalance),
    accounts,
    debts: activeDebts,
    hasSources: accounts.some((a) => a.balance !== null) || debtViews.length > 0,
  }
}

/** Serie de 12 meses. Quien llama ya verificó `networth.history`. */
export async function getNetWorthHistorySeries(admin: Admin, hid: string, userId: string, nowIso: string): Promise<HistoryPoint[]> {
  const { items, points } = await load(admin, hid, userId)
  return monthlyHistory(items, points, nowIso)
}

/** Cuentas archivadas visibles (para restaurar). */
export async function getArchivedSources(admin: Admin, hid: string, userId: string): Promise<{ id: string; name: string; kind: SourceKind; archivedAt: string }[]> {
  return (await visibleSources(admin, hid, userId))
    .filter((s) => s.archived_at)
    .sort((a, b) => b.archived_at!.localeCompare(a.archived_at!))
    .map((s) => ({ id: s.id, name: s.name, kind: s.kind, archivedAt: s.archived_at! }))
}

/**
 * Nuevo saldo: actualiza la cuenta y guarda el registro histórico. Si el
 * registro falla, se devuelve el saldo anterior (no queda a medias).
 * Quien llama ya verificó que la cuenta es visible y no es una tarjeta.
 */
export async function updateSourceBalance(
  admin: Admin,
  hid: string,
  sourceId: string,
  balance: number,
  origin: 'manual' | 'statement_import' = 'manual',
): Promise<boolean> {
  const { data: prev } = await admin.from('financial_sources').select('current_balance, balance_updated_at').eq('id', sourceId).eq('household_id', hid).is('archived_at', null).maybeSingle()
  if (!prev) return false
  const now = new Date().toISOString()
  const { error } = await admin.from('financial_sources').update({ current_balance: balance, balance_updated_at: now, updated_at: now }).eq('id', sourceId).eq('household_id', hid)
  if (error) return false
  const { error: snapErr } = await admin.from('source_balance_snapshots').insert({ household_id: hid, source_id: sourceId, balance, recorded_at: now, origin })
  if (snapErr) {
    await admin.from('financial_sources').update({ current_balance: prev.current_balance, balance_updated_at: prev.balance_updated_at }).eq('id', sourceId)
    return false
  }
  return true
}
