// Grupos de Mi patrimonio (puro, para vitest y para el contexto de Zafi).
// · Activos, de más líquido a menos: Efectivo y equivalentes, Inversiones,
//   Vehículos, Inmuebles y Otros.
// · Deudas por plazo: corto (tarjetas, informales y préstamos a los que les
//   falta un año o menos) y largo (los demás préstamos). Las deudas que se
//   agregan en Mis cuentas no tienen tasa ni pago: van en "Otras deudas".

import type { SourceKind } from './sources'

export type DebtPurpose = 'vehicle' | 'real_estate' | 'personal'

export const PURPOSE_LABEL: Record<DebtPurpose, { emoji: string; label: string }> = {
  vehicle: { emoji: '🚗', label: 'Vehículo' },
  real_estate: { emoji: '🏠', label: 'Inmueble' },
  personal: { emoji: '👤', label: 'Personal' },
}

/** Datos de una deuda de Plan › Deudas. */
export interface DebtTerms {
  debtType: 'credit' | 'loan' | 'informal'
  purpose: DebtPurpose | null
  /** Tasa anual en porcentaje. */
  interestRate: number
  monthlyPayment: number
  dueDay: number | null
  originalAmount: number | null
  /** Meses para terminarla al ritmo actual; null si el pago no alcanza o no hay pago. */
  monthsLeft: number | null
}

export interface GroupItem {
  kind: SourceKind
  balance: number | null
  debtTerms?: DebtTerms | null
}

export interface Group<T> {
  id: string
  label: string
  emoji: string
  hint: string
  items: T[]
  /** Suma de los saldos (las cuentas sin saldo no suman). */
  total: number
  /** Suma de los pagos mensuales (solo deudas). */
  monthly: number
}

type GroupDef = { id: string; label: string; emoji: string; hint: string }

const ASSET_GROUPS: (GroupDef & { kinds: SourceKind[] })[] = [
  { id: 'cash', label: 'Efectivo y equivalentes', emoji: '💵', hint: 'Cuentas y efectivo', kinds: ['bank_account', 'cash'] },
  { id: 'investments', label: 'Inversiones', emoji: '📈', hint: 'Plazos fijos, fondos y acciones', kinds: ['investment'] },
  { id: 'vehicles', label: 'Vehículos', emoji: '🚗', hint: 'Carros y motos', kinds: ['vehicle'] },
  { id: 'real_estate', label: 'Inmuebles', emoji: '🏠', hint: 'Casas, apartamentos y terrenos', kinds: ['real_estate'] },
  { id: 'other', label: 'Otros activos', emoji: '💎', hint: 'Todo lo demás', kinds: ['other_asset'] },
]

const LIABILITY_GROUPS: GroupDef[] = [
  { id: 'short', label: 'Corto plazo', emoji: '⏱️', hint: 'Tarjetas y deudas de un año o menos' },
  { id: 'long', label: 'Largo plazo', emoji: '🗓️', hint: 'Préstamos de vehículos, inmuebles y más de un año' },
  { id: 'other', label: 'Otras deudas', emoji: '🧾', hint: 'Sin tasa ni pago registrados' },
]

export type LiabilityTerm = 'short' | 'long' | 'other'

/** Plazo de una deuda. */
export function liabilityTerm(terms: DebtTerms | null | undefined): LiabilityTerm {
  if (!terms) return 'other'
  if (terms.debtType !== 'loan') return 'short'
  return terms.monthsLeft !== null && terms.monthsLeft <= 12 ? 'short' : 'long'
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function build<T extends GroupItem>(def: GroupDef, items: T[]): Group<T> {
  return {
    ...def,
    items,
    total: r2(items.reduce((s, i) => s + (i.balance ?? 0), 0)),
    monthly: r2(items.reduce((s, i) => s + (i.debtTerms?.monthlyPayment ?? 0), 0)),
  }
}

/** Activos agrupados en orden de liquidez; solo los grupos con algo. */
export function groupAssets<T extends GroupItem>(items: T[]): Group<T>[] {
  return ASSET_GROUPS
    .map((g) => build(g, items.filter((i) => g.kinds.includes(i.kind))))
    .filter((g) => g.items.length > 0)
}

/** Deudas agrupadas por plazo; solo los grupos con algo. */
export function groupLiabilities<T extends GroupItem>(items: T[]): Group<T>[] {
  return LIABILITY_GROUPS
    .map((g) => build(g, items.filter((i) => liabilityTerm(i.debtTerms) === g.id)))
    .filter((g) => g.items.length > 0)
}
