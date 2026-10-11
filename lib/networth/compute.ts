// Patrimonio neto (puro, para vitest). Saldos DECLARADOS por el usuario en
// Mis Fuentes, más las deudas del módulo Deudas como pasivos de solo lectura
// (así no se cuentan dos veces). Solo quetzales en v1.
//
// · netWorth = activos − pasivos; las fuentes archivadas no cuentan.
// · Variación del mes: contra el cierre del mes ANTERIOR (nunca un periodo
//   parcial), con el último saldo de cada fuente a esa fecha (carry-forward).
//   Se compara lo comparable: una fuente nueva este mes (sin saldo al cierre)
//   no entra ni en la referencia ni en la variación.
// · Desactualizada: más de 30 días sin actualizar el saldo (sigue contando).

export type Side = 'asset' | 'liability'

export interface NetWorthItem {
  id: string
  side: Side
  currentBalance: number // siempre ≥ 0; el signo lo da side
  balanceUpdatedAt: string | null // ISO; null = no aplica (deudas)
  archivedAt: string | null
}

export interface BalancePoint {
  itemId: string
  balance: number
  recordedAt: string // ISO
}

export interface NetWorthSummary {
  assets: number
  liabilities: number
  netWorth: number
  deltaVsPrevMonthEnd: number | null
  staleSourceIds: string[]
}

export const STALE_AFTER_DAYS = 30
/** Guatemala: UTC−6 todo el año (sin horario de verano). */
export const TZ_OFFSET_HOURS = -6

const DAY_MS = 86_400_000

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Fecha local (YYYY-MM-DD) de un instante. */
export function localDate(iso: string): string {
  return new Date(Date.parse(iso) + TZ_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10)
}

/** Último día del mes anterior a `today`. */
export function prevMonthEnd(today: string): string {
  const [y, m] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
}

/** Días completos desde `iso` hasta `nowIso`. */
export function daysSince(iso: string, nowIso: string): number {
  return Math.floor((Date.parse(nowIso) - Date.parse(iso)) / DAY_MS)
}

export function isStale(item: NetWorthItem, nowIso: string): boolean {
  return !!item.balanceUpdatedAt && daysSince(item.balanceUpdatedAt, nowIso) > STALE_AFTER_DAYS
}

/** Saldo de cada fuente al final del día `date` (último registro ≤ date). */
export function balancesAt(items: NetWorthItem[], points: BalancePoint[], date: string): Map<string, number> {
  const existing = new Map(items.map((i) => [i.id, i]))
  const latest = new Map<string, { at: string; balance: number }>()
  for (const p of points) {
    if (localDate(p.recordedAt) > date) continue
    const item = existing.get(p.itemId)
    if (!item) continue
    // Archivada antes de esa fecha: ya no se tenía.
    if (item.archivedAt && localDate(item.archivedAt) <= date) continue
    const prev = latest.get(p.itemId)
    if (!prev || p.recordedAt > prev.at) latest.set(p.itemId, { at: p.recordedAt, balance: p.balance })
  }
  return new Map(Array.from(latest.entries()).map(([id, v]) => [id, v.balance]))
}

function signed(items: Map<string, NetWorthItem>, balances: Map<string, number>): number {
  let total = 0
  for (const [id, b] of Array.from(balances.entries())) {
    const item = items.get(id)
    if (item) total += item.side === 'asset' ? b : -b
  }
  return total
}

export function summarize(items: NetWorthItem[], points: BalancePoint[], nowIso: string): NetWorthSummary {
  const live = items.filter((i) => !i.archivedAt)
  const assets = round2(live.filter((i) => i.side === 'asset').reduce((s, i) => s + i.currentBalance, 0))
  const liabilities = round2(live.filter((i) => i.side === 'liability').reduce((s, i) => s + i.currentBalance, 0))
  const netWorth = round2(assets - liabilities)

  const ref = balancesAt(items, points, prevMonthEnd(localDate(nowIso)))
  let deltaVsPrevMonthEnd: number | null = null
  if (ref.size > 0) {
    const byId = new Map(items.map((i) => [i.id, i]))
    // Valor actual de las mismas fuentes (las archivadas desde entonces valen 0).
    const now = new Map(Array.from(ref.keys()).map((id) => {
      const it = byId.get(id)!
      return [id, it.archivedAt ? 0 : it.currentBalance]
    }))
    deltaVsPrevMonthEnd = round2(signed(byId, now) - signed(byId, ref))
  }

  return {
    assets,
    liabilities,
    netWorth,
    deltaVsPrevMonthEnd,
    staleSourceIds: live.filter((i) => isStale(i, nowIso)).map((i) => i.id),
  }
}

export interface HistoryPoint {
  month: string // YYYY-MM
  netWorth: number
}

/**
 * Patrimonio al cierre de cada uno de los últimos 12 meses COMPLETOS, con
 * carry-forward. Los meses sin ningún dato se omiten (no se interpolan).
 */
export function monthlyHistory(items: NetWorthItem[], points: BalancePoint[], nowIso: string, months = 12): HistoryPoint[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const out: HistoryPoint[] = []
  let end = prevMonthEnd(localDate(nowIso))
  for (let i = 0; i < months; i++) {
    const bal = balancesAt(items, points, end)
    if (bal.size > 0) out.push({ month: end.slice(0, 7), netWorth: round2(signed(byId, bal)) })
    end = prevMonthEnd(end)
  }
  return out.reverse()
}
