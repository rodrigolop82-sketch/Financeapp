// Progreso de retos (puro, para vitest). Se calcula desde las transacciones:
// no hay cron ni contadores guardados. Un reto nunca "falla": si se desvía,
// se dice "Te desviaste, aún puedes retomar".

export type ChallengeType = 'spend_reduction' | 'logging_streak' | 'no_spend_category' | 'review_subscriptions'

export interface ChallengeInput {
  type: ChallengeType
  startedAt: string // YYYY-MM-DD
  durationDays: number
  categoryId: string | null
  baselineDaily: number | null
}

export interface ProgressTx {
  date: string
  amount: number
  categoryId: string | null
  /** Gasto (los ingresos y el ahorro también cuentan como "registro"). */
  isExpense: boolean
}

export interface ChallengeProgress {
  dayIndex: number
  durationDays: number
  completedDays: boolean[]
  streak: number
  estimatedSavings: number | null
  status: 'on_track' | 'off_track' | 'completed'
  /** Días cumplidos (para el cierre y el historial). */
  daysMet: number
}

export const OFF_TRACK_RUN = 3

const DAY_MS = 86_400_000
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS

export function addDays(date: string, n: number): string {
  return new Date((toDay(date) + n) * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  return Math.round(toDay(b) - toDay(a))
}

/** Último día del reto (incluido). */
export function endsAt(startedAt: string, durationDays: number): string {
  return addDays(startedAt, durationDays - 1)
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Gasto diario promedio de la categoría en los últimos 3 meses COMPLETOS
 * antes del mes de inicio (nunca el mes en curso). El mes del primer
 * movimiento puede estar a medias y no cuenta. null sin al menos 1 mes completo.
 */
export function baselineDaily(
  txs: ProgressTx[],
  categoryId: string,
  startedAt: string,
  earliestMonth: string | null,
): number | null {
  if (!earliestMonth) return null
  const months: string[] = []
  let [y, m] = startedAt.slice(0, 7).split('-').map(Number)
  for (let i = 0; i < 3; i++) {
    m -= 1
    if (m < 1) { m = 12; y -= 1 }
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key <= earliestMonth) break
    months.push(key)
  }
  if (months.length === 0) return null
  const set = new Set(months)
  const spent = txs.filter((t) => t.isExpense && t.categoryId === categoryId && set.has(t.date.slice(0, 7))).reduce((s, t) => s + t.amount, 0)
  const days = months.reduce((s, k) => s + daysInMonth(k), 0)
  return round2(spent / days)
}

export function computeProgress(
  c: ChallengeInput,
  txs: ProgressTx[],
  today: string,
  opts: { reviewDone?: boolean } = {},
): ChallengeProgress {
  const end = endsAt(c.startedAt, c.durationDays)
  const finished = today > end
  const elapsed = Math.max(0, Math.min(c.durationDays, daysBetween(c.startedAt, finished ? end : today) + 1))

  const inCategory = (t: ProgressTx) => t.isExpense && !!c.categoryId && t.categoryId === c.categoryId
  const byDay = new Map<string, { spent: number; any: boolean }>()
  for (const t of txs) {
    if (t.date < c.startedAt || t.date > end) continue
    const d = byDay.get(t.date) ?? { spent: 0, any: false }
    d.any = true
    if (inCategory(t)) d.spent += t.amount
    byDay.set(t.date, d)
  }

  const met = (date: string): boolean => {
    const d = byDay.get(date) ?? { spent: 0, any: false }
    switch (c.type) {
      case 'logging_streak': return d.any
      case 'no_spend_category': return d.spent === 0
      case 'spend_reduction': return c.baselineDaily === null ? d.spent === 0 : d.spent <= c.baselineDaily
      case 'review_subscriptions': return !!opts.reviewDone
    }
  }

  const completedDays: boolean[] = []
  for (let i = 0; i < elapsed; i++) completedDays.push(met(addDays(c.startedAt, i)))

  // Racha: días seguidos cumplidos hasta hoy. Si hoy aún no cumple (p. ej. no
  // ha registrado), la racha cuenta desde ayer: el día no ha terminado.
  let streak = 0
  let i = completedDays.length - 1
  if (!finished && i >= 0 && !completedDays[i]) i--
  for (; i >= 0 && completedDays[i]; i--) streak++

  // Días cerrados (sin hoy, salvo que el reto ya terminó).
  const closed = finished ? completedDays : completedDays.slice(0, -1)
  const tail = closed.slice(-OFF_TRACK_RUN)
  const offTrack = tail.length === OFF_TRACK_RUN && tail.every((v) => !v)

  let estimatedSavings: number | null = null
  if ((c.type === 'spend_reduction' || c.type === 'no_spend_category') && c.baselineDaily !== null && c.baselineDaily > 0) {
    const spent = Array.from(byDay.entries())
      .filter(([date]) => date <= (finished ? end : today))
      .reduce((s, [, v]) => s + v.spent, 0)
    const saved = round2(c.baselineDaily * elapsed - spent)
    estimatedSavings = saved > 0 ? saved : null
  }

  const reviewComplete = c.type === 'review_subscriptions' && !!opts.reviewDone
  return {
    dayIndex: Math.max(1, elapsed),
    durationDays: c.durationDays,
    completedDays,
    streak,
    estimatedSavings,
    status: finished || reviewComplete ? 'completed' : offTrack ? 'off_track' : 'on_track',
    daysMet: completedDays.filter(Boolean).length,
  }
}
