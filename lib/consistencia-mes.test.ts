// Prueba de consistencia: con los mismos movimientos, ingresos, gastaste y
// ahorro deben dar igual en el puntaje (/score y Cerrar el mes), Cómo te fue
// (/resumen), Movimientos (/transacciones) e Inicio (/dashboard). Si alguien
// vuelve a sumar movimientos por su cuenta, esta prueba falla.

import { describe, expect, it } from 'vitest'
import { analyzeMonth, monthSaved, type CtfCategory, type CtfTx } from './como-te-fue'
import { buildScoreInput, type ScoreRaw } from './health-data'
import { computeHome, type HomeCategory } from './inicio'
import { enRango, resumirMovimientos } from './metricas-mes'
import { monthRange } from './movimientos'
import { DEFAULT_CAPS } from './recomendaciones'
import { calculateScore } from './score-calculator'
import { formatMoney } from './format'
import { dailySpend } from './resumen/daily-spend'

const MONTH = '2026-09'

const categories: CtfCategory[] = [
  { id: 'viv', name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 3000, pace_mode: 'fixed' },
  { id: 'ali', name: 'Alimentación', bucket: 'needs', budgeted_amount: 2000, pace_mode: 'linear' },
  { id: 'res', name: 'Restaurantes', bucket: 'wants', budgeted_amount: 800, pace_mode: 'linear' },
  { id: 'aho', name: 'Fondo de emergencia', bucket: 'savings', budgeted_amount: 1000 },
  { id: 'ext', name: 'Pago de deudas extra', bucket: 'savings', budgeted_amount: 500 },
  { id: 'old', name: 'Gimnasio', bucket: 'wants', budgeted_amount: 0, archived_at: '2026-09-20' },
  { id: 'sal', name: 'Salario', bucket: 'income', budgeted_amount: 0 },
]

let n = 0
const tx = (category_id: string | null, amount: number, date: string, type: 'expense' | 'income' = 'expense', transaction_type?: string): CtfTx =>
  ({ id: `t${n++}`, category_id, amount, date, type, transaction_type: transaction_type ?? (type === 'income' ? 'ingreso' : 'gasto') })

const salario = tx('sal', 15000, '2026-09-01', 'income')
const pagoTarjeta = tx(null, 1000, '2026-09-05', 'expense', 'ahorro') // desde Pagos del mes
const septiembre: CtfTx[] = [
  salario,
  tx('viv', 3000, '2026-09-01'),
  tx('ali', 1200, '2026-09-07'),
  tx('ali', 650.5, '2026-09-21'),
  tx('res', 400, '2026-09-12'),
  tx('old', 250, '2026-09-03'), // categoría archivada: sigue contando
  tx(null, 99.5, '2026-09-14'), // sin categoría
  tx('aho', 1000, '2026-09-02', 'expense', 'ahorro'),
  tx('ext', 500, '2026-09-15', 'expense', 'ahorro'),
  pagoTarjeta,
]
const otrosMeses: CtfTx[] = [
  tx('sal', 15000, '2026-08-01', 'income'),
  tx('viv', 3000, '2026-08-01'),
  tx('ali', 9999, '2026-10-01'),
]
const intereses = new Map([[pagoTarjeta.id, 240]])

/** Cada pantalla con su propia función, sobre los mismos datos. */
function pantallas(txs: CtfTx[]) {
  // Puntaje (/score) y Cerrar el mes (/cierre-mes): ambos usan loadScoreInput → buildScoreInput.
  const raw: ScoreRaw = {
    month: MONTH,
    profile: { total_income: 9000, total_fixed_expenses: 3000, total_savings: 0, income_type: 'fixed' },
    categories,
    subItems: [],
    incomes: [{ id: 'i', source: 'Salario', amount: 16000, frequency: 'monthly' } as never],
    txs,
    intereses,
    emergencyGoal: null,
    debts: [{ balance: 12000, min_payment: 1000 }],
  }
  const score = buildScoreInput(raw)
  // Cómo te fue (/resumen).
  const ctf = analyzeMonth(
    { categories, subs: [], incomes: [], txs, snapshots: {}, earliest: '2026-08', intereses },
    MONTH, DEFAULT_CAPS, formatMoney,
  ).current
  // Movimientos (/transacciones): el resumen del periodo elegido.
  const { from, to } = monthRange(MONTH)
  const mov = resumirMovimientos(enRango(txs, from, to), categories, intereses)
  // Inicio (/dashboard): los movimientos del mes.
  const home = computeHome(categories as HomeCategory[], enRango(txs, from, to), new Date(2026, 8, 20), 0, intereses)
  // Promedio diario de Cómo te fue (mes ya terminado: cuentan todos los días).
  const daily = dailySpend(MONTH, '2026-10-15', txs, categories, intereses)
  return { raw, score, ctf, mov, home, daily }
}

describe('consistencia entre pantallas (mes con ingresos)', () => {
  const { raw, score, ctf, mov, home, daily } = pantallas([...septiembre, ...otrosMeses])
  const ingresos = 15000
  const gastaste = 3000 + 1200 + 650.5 + 400 + 250 + 99.5 + 240 // + intereses de la tarjeta
  const ahorro = ingresos - gastaste

  it('ingresos iguales en todas', () => {
    expect(score.income).toBe(ingresos)
    expect(ctf.income).toBe(ingresos)
    expect(mov.ingresos).toBe(ingresos)
  })

  it('"Gastaste" igual en todas (sin ahorro ni abonos a deudas)', () => {
    expect(score.spent).toBe(gastaste)
    expect(ctf.spent).toBe(gastaste)
    expect(mov.consumo).toBe(gastaste)
    expect(home.spent).toBe(gastaste)
    expect(daily.spent).toBe(gastaste)
  })

  it('ahorro igual en todas', () => {
    expect(score.saved).toBe(ahorro)
    expect(monthSaved(ctf)).toBe(ahorro)
    expect(mov.ahorro).toBe(ahorro)
  })

  it('lo apartado se muestra aparte con el mismo monto', () => {
    expect(ctf.savingsBucket).toBe(1000 + 500 + 760)
    expect(mov.apartado + mov.abonosDeuda).toBe(ctf.savingsBucket)
  })

  it('no es provisional y el detalle del puntaje dice el mismo ahorro', () => {
    expect(score.provisional).toBe(false)
    const r = calculateScore(score)
    expect(r.provisional).toBe(false)
    expect(r.components.find((c) => c.key === 'savings')!.detail).toContain(formatMoney(ahorro))
    expect(raw.month).toBe(MONTH)
  })
})

describe('consistencia entre pantallas (mes sin ingresos registrados)', () => {
  const { score, ctf, mov, home } = pantallas(septiembre.filter((t) => t !== salario))
  const gastaste = 3000 + 1200 + 650.5 + 400 + 250 + 99.5 + 240

  it('ninguna calcula ahorro y todas dicen ingresos 0', () => {
    expect(ctf.income).toBe(0)
    expect(ctf.hasIncome).toBe(false)
    expect(monthSaved(ctf)).toBeNull()
    expect(mov.ingresos).toBe(0)
    expect(mov.ahorro).toBeNull()
  })

  it('el puntaje es provisional, con el ingreso del plan y el ahorro pendiente', () => {
    expect(score.provisional).toBe(true)
    expect(score.income).toBe(16000)
    const r = calculateScore(score)
    expect(r.provisional).toBe(true)
    expect(r.components.find((c) => c.key === 'savings')!.pending).toBe(true)
  })

  it('"Gastaste" sigue igual en todas', () => {
    expect(score.spent).toBe(gastaste)
    expect(ctf.spent).toBe(gastaste)
    expect(mov.consumo).toBe(gastaste)
    expect(home.spent).toBe(gastaste)
  })
})
