// "Este mes en casa" y cuentas claras entre dos personas. Sin React.

import type { Person } from './hogar'

export type SplitMode = 'pool' | 'half' | 'income'

export const SPLIT_MODES: SplitMode[] = ['pool', 'half', 'income']

export function isSplitMode(v: unknown): v is SplitMode {
  return v === 'pool' || v === 'half' || v === 'income'
}

export interface HomeTx {
  amount: number
  paid_by: string | null
  scope: 'shared' | 'personal' | null
  category_id: string | null
}

export interface Settlement { from_user: string | null; to_user: string | null; amount: number }

export interface HomeMonth {
  total: number
  shared: number
  personal: number
  /** Por persona: lo pagado compartido y lo personal. */
  paidShared: Record<string, number>
  personalBy: Record<string, number>
  /** Por categoría: cuánto pagó cada persona de lo compartido. */
  categories: { categoryId: string | null; total: number; by: Record<string, number> }[]
  /** Por persona y categoría, lo personal. */
  personalCats: Record<string, { categoryId: string | null; total: number }[]>
}

const add = (o: Record<string, number>, k: string, v: number) => { o[k] = (o[k] ?? 0) + v }

export function summarizeMonth(txs: HomeTx[], fallbackPayer: string): HomeMonth {
  const paidShared: Record<string, number> = {}
  const personalBy: Record<string, number> = {}
  const cats = new Map<string | null, Record<string, number>>()
  const pcats: Record<string, Map<string | null, number>> = {}
  let shared = 0
  let personal = 0
  for (const t of txs) {
    const who = t.paid_by ?? fallbackPayer
    const amt = Number(t.amount) || 0
    if (t.scope === 'personal') {
      personal += amt
      add(personalBy, who, amt)
      const m = (pcats[who] ??= new Map())
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + amt)
    } else {
      shared += amt
      add(paidShared, who, amt)
      const by = cats.get(t.category_id) ?? {}
      add(by, who, amt)
      cats.set(t.category_id, by)
    }
  }
  const categories = Array.from(cats.entries())
    .map(([categoryId, by]) => ({ categoryId, by, total: Object.values(by).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
  const personalCats: HomeMonth['personalCats'] = {}
  for (const [who, m] of Object.entries(pcats)) {
    personalCats[who] = Array.from(m.entries()).map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
  }
  return { total: shared + personal, shared, personal, paidShared, personalBy, categories, personalCats }
}

/** Parte de lo compartido que le toca a `a` (0–1), o null en bolsa común / sin ingresos. */
export function shareOf(mode: SplitMode, a: Person, b: Person): number | null {
  if (mode === 'pool') return null
  if (mode === 'half') return 0.5
  const ia = Number(a.monthlyIncome) || 0
  const ib = Number(b.monthlyIncome) || 0
  if (ia <= 0 || ib <= 0) return null
  return ia / (ia + ib)
}

export interface Balance {
  from: Person
  to: Person
  amount: number
  /** % de lo compartido que le toca al dueño (a). */
  pctA: number
}

/**
 * Quién le pone cuánto a quién:
 * deuda = pagadoCompartido(A) − compartidoTotal × shareA − saldadoDelMes.
 * Lo saldado de B a A baja la deuda de B; de A a B la sube. Null si no
 * aplica (bolsa común, falta un ingreso) o ya están a mano (< 1).
 */
export function balanceOf(month: HomeMonth, mode: SplitMode, a: Person, b: Person, settled: Settlement[]): Balance | null {
  const share = shareOf(mode, a, b)
  if (share === null) return null
  const settledBtoA = settled.filter((s) => s.from_user === b.id && s.to_user === a.id).reduce((n, s) => n + Number(s.amount), 0)
  const settledAtoB = settled.filter((s) => s.from_user === a.id && s.to_user === b.id).reduce((n, s) => n + Number(s.amount), 0)
  const diff = (month.paidShared[a.id] ?? 0) - month.shared * share - settledBtoA + settledAtoB
  const pctA = Math.round(share * 100)
  if (Math.abs(diff) < 1) return null
  return diff > 0 ? { from: b, to: a, amount: diff, pctA } : { from: a, to: b, amount: -diff, pctA }
}

export function splitLabel(mode: SplitMode): { emoji: string; title: string; help: (a?: Person, b?: Person) => string } {
  switch (mode) {
    case 'pool':
      return { emoji: '🫙', title: 'Bolsa común', help: () => 'Todo sale de lo mismo. No llevamos cuentas entre nosotros.' }
    case 'half':
      return { emoji: '🤝', title: 'Mitad y mitad', help: () => 'A cada uno le toca el 50% de lo compartido.' }
    case 'income':
      return {
        emoji: '⚖️',
        title: 'Según lo que gana cada uno',
        help: (a, b) => {
          if (!a || !b) return 'Cada uno pone según sus ingresos.'
          const s = shareOf('income', a, b)
          return s === null
            ? 'Cada uno pone según sus ingresos. Falta el ingreso de alguno.'
            : `${a.name} ${Math.round(s * 100)}% · ${b.name} ${100 - Math.round(s * 100)}%, según sus ingresos.`
        },
      }
  }
}

/** Explicación bajo "Luis le pone Q X a Ana". */
export function balanceHelp(mode: SplitMode, b: Balance, sharedLabel: string): string {
  const base = splitLabel(mode).title
  const pct = mode === 'income' ? ` (${b.pctA} / ${100 - b.pctA})` : ''
  return `${base}${pct}. Lo compartido: ${sharedLabel}.`
}
