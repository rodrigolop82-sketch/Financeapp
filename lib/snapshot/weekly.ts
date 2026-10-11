// Resumen semanal ("Tu semana"). Puro: sin Supabase, para vitest.
// Siempre una semana COMPLETA (lunes a domingo); nunca la semana en curso.
// · Total = gasto en categorías variables. Lo fijo (renta, cuotas) va aparte
//   en fixedPaid: pagarlo un día no es un patrón semanal.
// · Ritmo esperado: presupuesto variable del mes ÷ días del mes, día por día
//   (si la semana cruza dos meses, cada día usa el ritmo de su mes).

export interface SnapshotTx {
  date: string // YYYY-MM-DD
  amount: number // positivo
  categoryId: string | null
}

export interface SnapshotCategory {
  id: string
  name: string
  fixed: boolean
}

export type Verdict = 'en_linea' | 'en_riesgo' | 'sobre_ritmo'

export interface WeeklySnapshot {
  weekStart: string
  weekEnd: string
  totalVariable: number
  fixedPaid: number
  expectedVariable: number | null
  verdict: Verdict | null
  deltaVsExpectedPct: number | null
  byDay: { date: string; amount: number }[]
  topCategories: { categoryId: string; name: string; amount: number; deltaVsPrevWeek: number | null }[]
  insight: { kind: 'day_concentration' | 'category_up' | 'none'; params: Record<string, number | string> }
  surplusVsExpected: number | null
  isSparse: boolean
  txCount: number
}

/** Umbrales del veredicto (gasto ÷ esperado). */
export const VERDICT_ON_TRACK_MAX = 1.0
export const VERDICT_AT_RISK_MAX = 1.1
/** Un día "concentra" el gasto si llega a este porcentaje del total. */
export const DAY_CONCENTRATION_MIN = 0.3
/** Alza mínima de una categoría vs la semana previa para mencionarla. */
export const CATEGORY_UP_MIN_Q = 50
/** Con menos movimientos que esto la semana es "dispersa". */
export const SPARSE_MIN_TXS = 3

export const VERDICT_COPY: Record<Verdict, string> = {
  en_linea: 'Vas en línea',
  en_riesgo: 'Vas en riesgo',
  sobre_ritmo: 'Vas por encima del ritmo',
}

export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const DAY_MS = 86_400_000

function toDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

export function addDays(date: string, n: number): string {
  return new Date((toDay(date) + n) * DAY_MS).toISOString().slice(0, 10)
}

/** Lunes de la semana de `date`. */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = domingo
  return addDays(date, -((dow + 6) % 7))
}

/** Lunes de la última semana completa antes de `today`. */
export function lastCompleteWeekStart(today: string): string {
  return addDays(mondayOf(today), -7)
}

export function isMonday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).getUTCDay() === 1
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface ComputeInput {
  weekStart: string
  /** Gastos (sin ahorro ni ingresos) de esta semana y de la anterior. */
  txs: SnapshotTx[]
  categories: SnapshotCategory[]
  /** Presupuesto por mes ('YYYY-MM') y categoría. */
  budgets: Record<string, Record<string, number>>
}

function sumByCategory(txs: SnapshotTx[], variable: (id: string | null) => boolean): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txs) {
    if (!variable(t.categoryId)) continue
    const k = t.categoryId ?? ''
    m.set(k, (m.get(k) ?? 0) + t.amount)
  }
  return m
}

export function computeWeeklySnapshot(input: ComputeInput): WeeklySnapshot {
  const { weekStart } = input
  const weekEnd = addDays(weekStart, 6)
  const prevStart = addDays(weekStart, -7)
  const catById = new Map(input.categories.map((c) => [c.id, c]))
  const isFixed = (id: string | null) => !!id && !!catById.get(id)?.fixed
  const isVariable = (id: string | null) => !isFixed(id)

  const week = input.txs.filter((t) => t.date >= weekStart && t.date <= weekEnd && t.amount > 0)
  const prev = input.txs.filter((t) => t.date >= prevStart && t.date < weekStart && t.amount > 0)

  const totalVariable = round2(week.filter((t) => isVariable(t.categoryId)).reduce((s, t) => s + t.amount, 0))
  const fixedPaid = round2(week.filter((t) => isFixed(t.categoryId)).reduce((s, t) => s + t.amount, 0))

  // Ritmo esperado, día por día con el presupuesto variable de su mes.
  let expected = 0
  let anyBudget = false
  const byDay: { date: string; amount: number }[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i)
    const month = date.slice(0, 7)
    const budget = Object.entries(input.budgets[month] ?? {})
      .filter(([id]) => catById.has(id) && !isFixed(id))
      .reduce((s, [, v]) => s + Math.max(0, Number(v) || 0), 0)
    if (budget > 0) anyBudget = true
    expected += budget / daysInMonth(month)
    byDay.push({
      date,
      amount: round2(week.filter((t) => t.date === date && isVariable(t.categoryId)).reduce((s, t) => s + t.amount, 0)),
    })
  }
  const expectedVariable = anyBudget ? round2(expected) : null

  let verdict: Verdict | null = null
  let deltaVsExpectedPct: number | null = null
  if (expectedVariable !== null && expectedVariable > 0) {
    const ratio = totalVariable / expectedVariable
    verdict = ratio <= VERDICT_ON_TRACK_MAX ? 'en_linea' : ratio <= VERDICT_AT_RISK_MAX ? 'en_riesgo' : 'sobre_ritmo'
    deltaVsExpectedPct = Math.round((ratio - 1) * 100)
  }

  const cur = sumByCategory(week, isVariable)
  const before = sumByCategory(prev, isVariable)
  const prevHasData = prev.length > 0
  const nameOf = (id: string) => (id ? catById.get(id)?.name ?? 'Otra categoría' : 'Sin categoría')

  const topCategories = Array.from(cur.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amount]) => ({
      categoryId: id,
      name: nameOf(id),
      amount: round2(amount),
      deltaVsPrevWeek: prevHasData ? round2(amount - (before.get(id) ?? 0)) : null,
    }))

  // Observación determinista.
  let insight: WeeklySnapshot['insight'] = { kind: 'none', params: {} }
  if (totalVariable > 0) {
    const topDayIdx = byDay.reduce((best, d, i) => (d.amount > byDay[best].amount ? i : best), 0)
    const share = byDay[topDayIdx].amount / totalVariable
    if (share >= DAY_CONCENTRATION_MIN) {
      insight = { kind: 'day_concentration', params: { day: DAY_NAMES[topDayIdx], pct: Math.round(share * 100) } }
    } else if (prevHasData) {
      let best: { id: string; up: number } | null = null
      for (const [id, v] of Array.from(cur.entries())) {
        const up = v - (before.get(id) ?? 0)
        if (up >= CATEGORY_UP_MIN_Q && (!best || up > best.up)) best = { id, up }
      }
      if (best) insight = { kind: 'category_up', params: { category: nameOf(best.id), amount: round2(best.up) } }
    }
  }

  const surplus = expectedVariable !== null ? round2(expectedVariable - totalVariable) : null

  return {
    weekStart,
    weekEnd,
    totalVariable,
    fixedPaid,
    expectedVariable,
    verdict,
    deltaVsExpectedPct,
    byDay,
    topCategories,
    insight,
    surplusVsExpected: surplus !== null && surplus > 0 ? surplus : null,
    isSparse: week.length < SPARSE_MIN_TXS,
    txCount: week.length,
  }
}

/** Texto de la observación determinista. */
export function insightText(s: WeeklySnapshot, fmt: (n: number) => string): string | null {
  if (s.insight.kind === 'day_concentration') {
    return `El ${s.insight.params.day} concentró ${s.insight.params.pct}% de tu gasto semanal.`
  }
  if (s.insight.kind === 'category_up') {
    return `${s.insight.params.category} subió ${fmt(Number(s.insight.params.amount))} respecto a la semana anterior.`
  }
  return null
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** "5 – 11 oct" o "29 sept – 5 oct". */
export function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6)
  const [, m1, d1] = weekStart.split('-').map(Number)
  const [, m2, d2] = end.split('-').map(Number)
  return m1 === m2
    ? `${d1} – ${d2} ${MONTHS_SHORT[m2 - 1]}`
    : `${d1} ${MONTHS_SHORT[m1 - 1]} – ${d2} ${MONTHS_SHORT[m2 - 1]}`
}

/** Promedio de las 4 semanas completas anteriores (para semanas sin presupuesto). */
export function averagePreviousWeeks(txs: SnapshotTx[], categories: SnapshotCategory[], weekStart: string, weeks = 4): number | null {
  const fixed = new Set(categories.filter((c) => c.fixed).map((c) => c.id))
  const from = addDays(weekStart, -7 * weeks)
  const rel = txs.filter((t) => t.date >= from && t.date < weekStart && !(t.categoryId && fixed.has(t.categoryId)))
  if (rel.length === 0) return null
  // Solo semanas con movimientos: un hogar nuevo no tiene 4 semanas de historia.
  const withData = new Set(rel.map((t) => mondayOf(t.date))).size
  return round2(rel.reduce((s, t) => s + t.amount, 0) / withData)
}
