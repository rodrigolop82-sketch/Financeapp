// Detector de cobros mensuales recurrentes (suscripciones, gimnasio,
// internet…). Puro: sin Supabase, para probarlo con vitest. La capa de datos
// (lib/recurring/data.ts) carga las transacciones y aplica las decisiones
// del hogar (recurring_overrides) pasando las claves a excluir.
//
// Reglas (v1, solo cadencia mensual y solo gastos):
// · ≥ 3 cobros en ≥ 3 meses calendario COMPLETOS distintos: un cobro del mes
//   en curso cuenta como ocurrencia, pero no sostiene él solo un mes.
// · Mediana de los intervalos entre cobros consecutivos entre 25 y 35 días.
// · Monto estable: el último dentro de ±25 % de la mediana de los anteriores,
//   y los anteriores también entre sí (descarta súper, gasolina, restaurantes).
// · "Posiblemente cancelada" si pasaron más de 45 días sin un cobro nuevo.
// · Alza de precio si el último difiere ≥ 5 % y ≥ Q 2 de la mediana previa.

export interface RecurringTxInput {
  id: string
  date: string // YYYY-MM-DD
  amount: number // positivo
  description: string | null
  categoryId: string | null
}

export interface RecurringCharge {
  merchantKey: string
  displayName: string
  categoryId: string | null
  /** Mediana de los últimos 3 cobros. */
  typicalAmount: number
  lastAmount: number
  lastDate: string
  nextExpectedDate: string
  occurrences: number
  status: 'active' | 'possibly_cancelled'
  priceChange: { from: number; to: number } | null
  /** Cobros del grupo, del más reciente al más viejo. */
  history: { date: string; amount: number }[]
}

export const MIN_OCCURRENCES = 3
export const MIN_COMPLETE_MONTHS = 3
export const MIN_INTERVAL_DAYS = 25
export const MAX_INTERVAL_DAYS = 35
export const AMOUNT_TOLERANCE = 0.25
export const CANCELLED_AFTER_DAYS = 45
export const PRICE_CHANGE_MIN_PCT = 0.05
export const PRICE_CHANGE_MIN_Q = 2

/** Prefijos de procesador / tipo de cargo que no son parte del comercio. */
const LEADING_NOISE = new Set([
  'pos', 'compra', 'compras', 'pago', 'pagos', 'cargo', 'cargos', 'debito', 'credito', 'tc', 'td', 'visa', 'mastercard', 'mc',
  'consumo', 'recurrente', 'suscripcion', 'internet', 'ecommerce', 'web', 'paypal', 'dlocal', 'pp', 'sq', 'tst',
])
/** Palabras sin valor para identificar al comercio (dominios, razón social, país). */
const NOISE_WORDS = new Set([
  'www', 'com', 'net', 'org', 'co', 'io', 'inc', 'ltd', 'ltda', 'llc', 'sa', 's', 'a', 'de', 'cv', 'bv', 'ab',
  'gt', 'gtm', 'gua', 'guatemala', 'us', 'usa', 'help', 'bill', 'billing',
])

/**
 * Clave estable del comercio: minúsculas, sin acentos, sin referencias
 * numéricas ni prefijos de procesador, espacios colapsados.
 * "NETFLIX.COM 866-579-7172" y "Netflix.com #12345" → "netflix".
 */
export function normalizeMerchantKey(description: string | null | undefined): string | null {
  if (!description) return null
  const tokens = description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    // Referencias: cualquier palabra con dígitos.
    .filter((t) => !/\d/.test(t))
  while (tokens.length > 1 && LEADING_NOISE.has(tokens[0])) tokens.shift()
  const kept = tokens.filter((t) => !NOISE_WORDS.has(t))
  const key = kept.join(' ').slice(0, 60).trim()
  return key || null
}

const DAY_MS = 86_400_000

function dayNum(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
}

export function daysBetween(a: string, b: string): number {
  return dayNum(b) - dayNum(a)
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Mismo día del mes en el mes siguiente a `date` (el último día si no existe). */
export function nextMonthlyDate(date: string, anchorDay: number): string {
  let [y, m] = date.split('-').map(Number)
  m += 1
  if (m > 12) { m = 1; y += 1 }
  const d = Math.min(anchorDay, daysInMonth(y, m))
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Día del mes más repetido entre los cobros (el mayor si hay empate). */
function anchorDayOf(dates: string[]): number {
  const counts = new Map<number, number>()
  for (const d of dates) {
    const day = Number(d.slice(8, 10))
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  let best = 1
  let bestCount = 0
  for (const [day, c] of Array.from(counts.entries())) {
    if (c > bestCount || (c === bestCount && day > best)) { best = day; bestCount = c }
  }
  return best
}

function withinTolerance(value: number, ref: number): boolean {
  if (ref <= 0) return false
  return Math.abs(value - ref) / ref <= AMOUNT_TOLERANCE
}

export interface DetectOptions {
  /** Hoy (YYYY-MM-DD, zona del hogar). */
  today: string
  /** Claves a excluir (overrides del hogar). */
  excludeKeys?: Iterable<string>
  /** Categorías que no son suscripciones (renta, hipoteca, préstamos). */
  excludeCategoryIds?: Iterable<string>
  /** Transacciones ya cubiertas por el módulo de deudas. */
  excludeTransactionIds?: Iterable<string>
}

export function detectRecurringCharges(txs: RecurringTxInput[], opts: DetectOptions): RecurringCharge[] {
  const excludeKeys = new Set(opts.excludeKeys ?? [])
  const excludeCats = new Set(opts.excludeCategoryIds ?? [])
  const excludeTx = new Set(opts.excludeTransactionIds ?? [])
  const currentMonth = opts.today.slice(0, 7)

  const groups = new Map<string, RecurringTxInput[]>()
  for (const t of txs) {
    if (!(t.amount > 0) || t.date > opts.today) continue
    if (excludeTx.has(t.id)) continue
    if (t.categoryId && excludeCats.has(t.categoryId)) continue
    const key = normalizeMerchantKey(t.description)
    if (!key || excludeKeys.has(key)) continue
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }

  const out: RecurringCharge[] = []
  for (const [merchantKey, list] of Array.from(groups.entries())) {
    if (list.length < MIN_OCCURRENCES) continue
    const sorted = [...list].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))

    // Meses completos distintos (el mes en curso no sostiene un mes).
    const completeMonths = new Set(sorted.map((t) => t.date.slice(0, 7)).filter((m) => m < currentMonth))
    if (completeMonths.size < MIN_COMPLETE_MONTHS) continue

    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) intervals.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    const medInterval = median(intervals)
    if (medInterval < MIN_INTERVAL_DAYS || medInterval > MAX_INTERVAL_DAYS) continue

    const amounts = sorted.map((t) => Number(t.amount))
    const last = amounts[amounts.length - 1]
    const previous = amounts.slice(-6, -1)
    const prevMedian = median(previous)
    if (!withinTolerance(last, prevMedian)) continue
    if (!previous.every((a) => withinTolerance(a, prevMedian))) continue

    const lastTx = sorted[sorted.length - 1]
    const recentPrev = amounts.slice(-4, -1)
    const refPrev = median(recentPrev)
    const diff = last - refPrev
    const priceChange =
      Math.abs(diff) >= PRICE_CHANGE_MIN_Q && Math.abs(diff) / refPrev >= PRICE_CHANGE_MIN_PCT
        ? { from: round2(refPrev), to: round2(last) }
        : null

    const sinceLast = daysBetween(lastTx.date, opts.today)
    out.push({
      merchantKey,
      displayName: (lastTx.description ?? merchantKey).trim(),
      categoryId: lastTx.categoryId,
      typicalAmount: round2(median(amounts.slice(-3))),
      lastAmount: round2(last),
      lastDate: lastTx.date,
      nextExpectedDate: nextMonthlyDate(lastTx.date, anchorDayOf(sorted.map((t) => t.date))),
      occurrences: sorted.length,
      status: sinceLast > CANCELLED_AFTER_DAYS ? 'possibly_cancelled' : 'active',
      priceChange,
      history: sorted.slice().reverse().map((t) => ({ date: t.date, amount: round2(Number(t.amount)) })),
    })
  }

  return out.sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate) || a.merchantKey.localeCompare(b.merchantKey))
}

export interface RecurringTotals {
  activeCount: number
  monthlyTotal: number
  annualTotal: number
  /** Suma de alzas detectadas en los últimos 60 días. */
  priceIncrease: number
}

export function recurringTotals(charges: RecurringCharge[], today: string): RecurringTotals {
  const active = charges.filter((c) => c.status === 'active')
  const monthlyTotal = round2(active.reduce((s, c) => s + c.typicalAmount, 0))
  const priceIncrease = round2(
    active
      .filter((c) => c.priceChange && c.priceChange.to > c.priceChange.from && daysBetween(c.lastDate, today) <= 60)
      .reduce((s, c) => s + (c.priceChange!.to - c.priceChange!.from), 0),
  )
  return { activeCount: active.length, monthlyTotal, annualTotal: round2(monthlyTotal * 12), priceIncrease }
}

/**
 * Promedio de gasto de los últimos 3 meses COMPLETOS (nunca el mes en curso).
 * El mes del primer movimiento puede estar a medias, así que tampoco cuenta.
 * null si no queda ni un mes completo.
 */
export function averageCompleteMonthSpending(
  monthTotals: Record<string, number>,
  today: string,
  earliestMonth: string | null,
): number | null {
  if (!earliestMonth) return null
  const complete: string[] = []
  let [y, m] = today.slice(0, 7).split('-').map(Number)
  for (let i = 0; i < 3; i++) {
    m -= 1
    if (m < 1) { m = 12; y -= 1 }
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key <= earliestMonth) break
    complete.push(key)
  }
  if (complete.length === 0) return null
  return round2(complete.reduce((s, k) => s + (monthTotals[k] ?? 0), 0) / complete.length)
}

/** Fila de merchant_cancel_info ("cómo cancelar"). */
export interface CancelInfoRow {
  merchant_key: string
  display_name: string
  match_patterns: string[] | null
  cancel_url: string | null
  cancel_email: string | null
  steps: string[] | null
  notes: string | null
}

/**
 * Info de cancelación para un comercio: por clave exacta o por un patrón
 * que aparezca como palabra(s) completa(s) en la clave. Los patrones cortos
 * (< 5 letras, p. ej. "max") solo valen exactos, para no confundir "Max"
 * (streaming) con otra tienda que empiece igual.
 */
export function matchCancelInfo(merchantKey: string, rows: CancelInfoRow[]): CancelInfoRow | null {
  const exact = rows.find((r) => r.merchant_key === merchantKey)
  if (exact) return exact
  const padded = ` ${merchantKey} `
  for (const r of rows) {
    for (const raw of r.match_patterns ?? []) {
      const p = normalizeMerchantKey(raw)
      if (!p) continue
      if (p.replace(/ /g, '').length < 5 ? merchantKey === p : padded.includes(` ${p} `)) return r
    }
  }
  return null
}
