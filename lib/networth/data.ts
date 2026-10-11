// Capa de datos de patrimonio (solo servidor, service role). Los saldos son
// datos sensibles: nunca van a logs, mensajes de error, URLs ni a la IA.

import type { SupabaseClient } from '@supabase/supabase-js'
import { daysSince, isStale, monthlyHistory, summarize, type BalancePoint, type HistoryPoint, type NetWorthItem, type NetWorthSummary } from './compute'
import type { SourceKind } from './sources'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface SourceView {
  id: string
  kind: SourceKind
  side: 'asset' | 'liability'
  name: string
  institution: string | null
  balance: number
  /** Días desde la última actualización (null en deudas). */
  daysSinceUpdate: number | null
  stale: boolean
  /** Deuda del módulo Deudas: se edita allá. */
  fromDebts: boolean
}

export interface NetWorthData {
  summary: NetWorthSummary
  assets: SourceView[]
  liabilities: SourceView[]
  hasSources: boolean
}

type SourceRow = {
  id: string; kind: SourceKind; side: 'asset' | 'liability'; name: string; institution: string | null
  current_balance: number; balance_updated_at: string; archived_at: string | null
}
type DebtRow = { id: string; name: string; type: string; balance: number; is_paid: boolean | null; created_at: string | null }

async function load(admin: Admin, hid: string) {
  const [srcRes, snapRes, debtRes, debtSnapRes] = await Promise.all([
    admin.from('financial_sources').select('id, kind, side, name, institution, current_balance, balance_updated_at, archived_at').eq('household_id', hid),
    admin.from('source_balance_snapshots').select('source_id, balance, recorded_at').eq('household_id', hid).order('recorded_at', { ascending: true }).limit(5000),
    admin.from('debts').select('id, name, type, balance, is_paid, created_at').eq('household_id', hid),
    admin.from('debt_balance_snapshots').select('debt_id, balance, recorded_at').eq('household_id', hid).order('recorded_at', { ascending: true }).limit(5000),
  ])
  if (srcRes.error) throw new Error('No se pudieron leer tus fuentes')
  const sources = (srcRes.data ?? []) as SourceRow[]
  const debts = (debtRes.data ?? []) as DebtRow[]

  const items: NetWorthItem[] = [
    ...sources.map((s) => ({ id: s.id, side: s.side, currentBalance: Number(s.current_balance), balanceUpdatedAt: s.balance_updated_at, archivedAt: s.archived_at })),
    // Deudas pagadas valen 0 (no se "archivan": su historial sigue contando).
    ...debts.map((d) => ({ id: `debt:${d.id}`, side: 'liability' as const, currentBalance: d.is_paid ? 0 : Math.max(0, Number(d.balance)), balanceUpdatedAt: null, archivedAt: null })),
  ]
  const points: BalancePoint[] = [
    ...((snapRes.data ?? []) as { source_id: string; balance: number; recorded_at: string }[]).map((p) => ({ itemId: p.source_id, balance: Number(p.balance), recordedAt: p.recorded_at })),
    ...((debtSnapRes.data ?? []) as { debt_id: string; balance: number; recorded_at: string }[]).map((p) => ({ itemId: `debt:${p.debt_id}`, balance: Math.max(0, Number(p.balance)), recordedAt: p.recorded_at })),
  ]
  return { sources, debts, items, points }
}

export async function getNetWorth(admin: Admin, hid: string, nowIso: string): Promise<NetWorthData> {
  const { sources, debts, items, points } = await load(admin, hid)
  const summary = summarize(items, points, nowIso)
  const live = sources.filter((s) => !s.archived_at)
  const views: SourceView[] = live.map((s) => {
    const it = items.find((i) => i.id === s.id)!
    return {
      id: s.id, kind: s.kind, side: s.side, name: s.name, institution: s.institution, balance: Number(s.current_balance),
      daysSinceUpdate: daysSince(s.balance_updated_at, nowIso), stale: isStale(it, nowIso), fromDebts: false,
    }
  })
  const debtViews: SourceView[] = debts
    .filter((d) => !d.is_paid && Number(d.balance) > 0)
    .map((d) => ({
      id: `debt:${d.id}`, kind: d.type === 'loan' ? 'loan' : d.type === 'credit' ? 'credit_card' : 'other_liability',
      side: 'liability', name: d.name, institution: null, balance: Number(d.balance), daysSinceUpdate: null, stale: false, fromDebts: true,
    }))
  const byBalance = (a: SourceView, b: SourceView) => b.balance - a.balance
  return {
    summary,
    assets: views.filter((v) => v.side === 'asset').sort(byBalance),
    liabilities: [...views.filter((v) => v.side === 'liability'), ...debtViews].sort(byBalance),
    hasSources: live.length > 0 || debtViews.length > 0,
  }
}

/** Serie de 12 meses. Quien llama ya verificó `networth.history`. */
export async function getNetWorthHistorySeries(admin: Admin, hid: string, nowIso: string): Promise<HistoryPoint[]> {
  const { items, points } = await load(admin, hid)
  return monthlyHistory(items, points, nowIso)
}

/** Fuentes archivadas (para restaurar desde Ajustes). */
export async function getArchivedSources(admin: Admin, hid: string): Promise<{ id: string; name: string; kind: SourceKind; archivedAt: string }[]> {
  const { data } = await admin.from('financial_sources').select('id, name, kind, archived_at').eq('household_id', hid).not('archived_at', 'is', null).order('archived_at', { ascending: false })
  return ((data ?? []) as { id: string; name: string; kind: SourceKind; archived_at: string }[]).map((s) => ({ id: s.id, name: s.name, kind: s.kind, archivedAt: s.archived_at }))
}

/**
 * Nuevo saldo: actualiza la fuente y guarda el registro histórico. Si el
 * registro falla, se devuelve el saldo anterior (no queda a medias).
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
