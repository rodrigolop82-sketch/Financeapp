// Una sola fuente de verdad para ingresos, gasto y ahorro de un mes (o de
// cualquier periodo). La usan el puntaje, Cómo te fue, Movimientos, Cerrar
// el mes e Inicio; nadie más suma movimientos por su cuenta. Puro (sin React
// ni Supabase) para probarlo con vitest. Las consultas viven en
// lib/metricas-mes-data.ts.
//
// Definiciones:
// - Ingresos: movimientos type='income' registrados. Nunca el ingreso del
//   plan ni el del onboarding.
// - Gastaste (consumo): Lo básico + Gustos + sin categoría + intereses de
//   deudas. Nada más.
// - Apartado: lo que se fue a categorías de Ahorro y deudas (transferencias a
//   ahorro, pago extra a deudas). No es consumo; se muestra aparte.
// - Abonos a deudas: pagos de deudas marcados en Pagos del mes, sin la parte
//   de intereses. No son consumo; los intereses sí.
// - Ahorro = ingresos − consumo. Incluye lo apartado, los abonos a capital y
//   los aportes a metas (no se suman aparte). Sin ingresos registrados no
//   hay ahorro: null y la pantalla dice "Falta registrar".

export type Bucket = 'needs' | 'wants' | 'savings' | 'income'

export interface MetricasTx {
  id?: string
  amount: number | string
  type: 'expense' | 'income'
  category_id: string | null
  /** Columna heredada: 'ahorro' en un gasto sin categoría = pago a deuda desde Pagos. */
  transaction_type?: string | null
  date: string
}

export interface MetricasCategoria {
  id: string
  bucket: Bucket | string
  name?: string
}

/** Intereses de cada pago a deuda (id del movimiento → intereses del mes). */
export type InteresesDeuda = ReadonlyMap<string, number>

export type Destino = 'ingreso' | 'basico' | 'gustos' | 'apartado' | 'deuda' | 'ignorar'

/** A qué parte del mes va un movimiento. */
export function destinoDe(
  tx: MetricasTx,
  bucketOf: ReadonlyMap<string, string>,
  intereses?: InteresesDeuda,
): Destino {
  if (tx.type === 'income') return 'ingreso'
  if (tx.id && intereses?.has(tx.id)) return 'deuda'
  if (tx.category_id) {
    const bucket = bucketOf.get(tx.category_id)
    if (bucket === 'savings') return 'apartado'
    if (bucket === 'income') return 'ignorar'
    if (bucket === 'wants') return 'gustos'
    return 'basico'
  }
  // Pagos del mes registra el pago de una deuda sin categoría y con 'ahorro'.
  if (tx.transaction_type === 'ahorro') return 'deuda'
  return 'basico'
}

export interface Metricas {
  ingresos: number
  /** Hay al menos un ingreso registrado. */
  tieneIngresos: boolean
  /** Lo básico + sin categoría + intereses de deudas. */
  basico: number
  gustos: number
  /** Parte de los pagos a deudas que fue interés (ya incluida en `basico`). */
  intereses: number
  /** "Gastaste": basico + gustos. */
  consumo: number
  /** Transferencias a categorías de Ahorro y deudas. */
  apartado: number
  /** Pagos a deudas sin los intereses. */
  abonosDeuda: number
  /** ingresos − consumo; null sin ingresos registrados. */
  ahorro: number | null
  /** ahorro − apartado − abonos (lo que quedó sin mover); null sin ingresos. */
  sinApartar: number | null
  /** % del ingreso que se ahorró (entero); null sin ingresos. */
  ahorroPct: number | null
  /** El periodo tiene algún movimiento. */
  hayMovimientos: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Métricas de todos los movimientos que se pasen (ya filtrados por periodo). */
export function resumirMovimientos(
  txs: MetricasTx[],
  categories: MetricasCategoria[],
  intereses?: InteresesDeuda,
): Metricas {
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket]))
  let ingresos = 0
  let basico = 0
  let gustos = 0
  let interes = 0
  let apartado = 0
  let abonos = 0
  for (const tx of txs) {
    const amt = Number(tx.amount) || 0
    switch (destinoDe(tx, bucketOf, intereses)) {
      case 'ingreso': ingresos += amt; break
      case 'basico': basico += amt; break
      case 'gustos': gustos += amt; break
      case 'apartado': apartado += amt; break
      case 'deuda': {
        const i = Math.min(Math.max(0, (tx.id && intereses?.get(tx.id)) || 0), Math.max(0, amt))
        interes += i
        abonos += amt - i
        break
      }
      case 'ignorar': break
    }
  }
  basico = round2(basico + interes)
  gustos = round2(gustos)
  const consumo = round2(basico + gustos)
  ingresos = round2(ingresos)
  apartado = round2(apartado)
  const abonosDeuda = round2(abonos)
  const tieneIngresos = ingresos > 0
  const ahorro = tieneIngresos ? round2(ingresos - consumo) : null
  return {
    ingresos,
    tieneIngresos,
    basico,
    gustos,
    intereses: round2(interes),
    consumo,
    apartado,
    abonosDeuda,
    ahorro,
    sinApartar: ahorro === null ? null : round2(ahorro - apartado - abonosDeuda),
    ahorroPct: ahorro === null ? null : Math.round((ahorro / ingresos) * 100),
    hayMovimientos: txs.length > 0,
  }
}

/** Métricas de un mes ('YYYY-MM'); ignora movimientos de otros meses. */
export function metricasMes(
  txs: MetricasTx[],
  month: string,
  categories: MetricasCategoria[],
  intereses?: InteresesDeuda,
): Metricas & { month: string } {
  return { month, ...resumirMovimientos(txs.filter((t) => t.date.startsWith(month)), categories, intereses) }
}

/** Movimientos entre dos fechas 'YYYY-MM-DD' (ambas incluidas). */
export function enRango<T extends { date: string }>(txs: T[], from: string, to: string): T[] {
  return txs.filter((t) => t.date >= from && t.date <= to)
}

/**
 * Intereses del mes de una deuda: saldo × tasa anual ÷ 12, sin pasar del
 * pago. Es aproximado (usa el saldo actual de la deuda).
 */
export function interesDelPago(pago: number, deuda: { balance: number | string; interest_rate: number | string }): number {
  const i = (Number(deuda.balance) || 0) * ((Number(deuda.interest_rate) || 0) / 100 / 12)
  return round2(Math.min(Math.max(0, pago), Math.max(0, i)))
}
