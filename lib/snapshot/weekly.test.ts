import { describe, it, expect } from 'vitest'
import {
  averagePreviousWeeks, computeWeeklySnapshot, insightText, isMonday, lastCompleteWeekStart, mondayOf, weekRangeLabel,
  type SnapshotCategory, type SnapshotTx,
} from './weekly'

const cats: SnapshotCategory[] = [
  { id: 'ali', name: 'Alimentación', fixed: false },
  { id: 'res', name: 'Restaurantes y salidas', fixed: false },
  { id: 'tra', name: 'Transporte', fixed: false },
  { id: 'viv', name: 'Vivienda/alquiler', fixed: true },
]
const W = '2026-10-05' // lunes
const tx = (date: string, amount: number, categoryId: string | null = 'ali'): SnapshotTx => ({ date, amount, categoryId })
// Presupuesto variable de 3100 en octubre (31 días) ⇒ 100 por día ⇒ 700 por semana.
const octBudget = { '2026-10': { ali: 2000, res: 800, tra: 300, viv: 3000 } }

describe('semanas', () => {
  it('lunes de la semana y última semana completa', () => {
    expect(mondayOf('2026-10-11')).toBe('2026-10-05') // domingo
    expect(mondayOf('2026-10-05')).toBe('2026-10-05')
    expect(lastCompleteWeekStart('2026-10-11')).toBe('2026-09-28')
    expect(lastCompleteWeekStart('2026-10-12')).toBe('2026-10-05')
    expect(isMonday('2026-10-05')).toBe(true)
    expect(isMonday('2026-10-06')).toBe(false)
  })
  it('rango legible', () => {
    expect(weekRangeLabel('2026-10-05')).toBe('5 – 11 oct')
    expect(weekRangeLabel('2026-09-28')).toBe('28 sept – 4 oct')
  })
})

describe('computeWeeklySnapshot', () => {
  it('límites lunes–domingo: el domingo cuenta, el lunes siguiente no', () => {
    const s = computeWeeklySnapshot({
      weekStart: W, categories: cats, budgets: octBudget,
      txs: [tx('2026-10-04', 999), tx('2026-10-05', 10), tx('2026-10-11', 20), tx('2026-10-12', 999), tx('2026-10-07', 5)],
    })
    expect(s.totalVariable).toBe(35)
    expect(s.byDay).toHaveLength(7)
    expect(s.byDay[0]).toEqual({ date: '2026-10-05', amount: 10 })
    expect(s.byDay[6]).toEqual({ date: '2026-10-11', amount: 20 })
  })

  it('categorías fijas fuera del total y reportadas en fixedPaid', () => {
    const s = computeWeeklySnapshot({
      weekStart: W, categories: cats, budgets: octBudget,
      txs: [tx('2026-10-05', 3000, 'viv'), tx('2026-10-06', 100), tx('2026-10-07', 50, 'res'), tx('2026-10-08', 30, 'tra')],
    })
    expect(s.totalVariable).toBe(180)
    expect(s.fixedPaid).toBe(3000)
    expect(s.expectedVariable).toBe(700)
  })

  it('semana que cruza dos meses usa el ritmo diario de cada mes', () => {
    // 28 sept – 4 oct: 3 días de septiembre a 200/día (6000 ÷ 30) + 4 de octubre a 100/día (3100 ÷ 31).
    const budgets = { '2026-09': { ali: 6000 }, '2026-10': { ali: 3100 } }
    const s = computeWeeklySnapshot({ weekStart: '2026-09-28', categories: cats, budgets, txs: [tx('2026-09-28', 100), tx('2026-09-29', 1), tx('2026-10-01', 1)] })
    expect(s.expectedVariable).toBe(3 * 200 + 4 * 100)
  })

  it('sin presupuesto no hay veredicto', () => {
    const s = computeWeeklySnapshot({ weekStart: W, categories: cats, budgets: {}, txs: [tx('2026-10-05', 100), tx('2026-10-06', 1), tx('2026-10-07', 1)] })
    expect(s.expectedVariable).toBeNull()
    expect(s.verdict).toBeNull()
    expect(s.surplusVsExpected).toBeNull()
  })

  it('umbrales del veredicto: 100% en línea, 110% en riesgo, más es sobre ritmo', () => {
    const mk = (total: number) => computeWeeklySnapshot({
      weekStart: W, categories: cats, budgets: octBudget,
      txs: [tx('2026-10-05', total / 3), tx('2026-10-06', total / 3), tx('2026-10-07', total / 3)],
    })
    expect(mk(700).verdict).toBe('en_linea')
    expect(mk(770).verdict).toBe('en_riesgo')
    expect(mk(771).verdict).toBe('sobre_ritmo')
    expect(mk(350).surplusVsExpected).toBe(350)
    expect(mk(800).surplusVsExpected).toBeNull()
  })

  it('concentración de día: 29% no, 30% sí', () => {
    // Un día con 29 (o 30) de 100 y el resto repartido entre los otros seis.
    const s = (top: number) => computeWeeklySnapshot({
      weekStart: W, categories: cats, budgets: octBudget,
      txs: [tx('2026-10-05', top), ...['06', '07', '08', '09', '10', '11'].map((d) => tx(`2026-10-${d}`, (100 - top) / 6))],
    })
    expect(s(29).insight.kind).not.toBe('day_concentration')
    expect(s(30).insight).toEqual({ kind: 'day_concentration', params: { day: 'lunes', pct: 30 } })
    expect(insightText(s(30), (n) => `Q ${n}`)).toBe('El lunes concentró 30% de tu gasto semanal.')
  })

  it('delta vs semana previa con y sin datos previos; alza de categoría', () => {
    const thisWeek = ['05', '06', '07', '08', '09', '10', '11'].map((d) => tx(`2026-10-${d}`, 20, 'res'))
    const withPrev = computeWeeklySnapshot({
      weekStart: W, categories: cats, budgets: octBudget,
      txs: [...thisWeek, tx('2026-10-05', 20), tx('2026-09-30', 60, 'res')],
    })
    expect(withPrev.topCategories[0]).toEqual({ categoryId: 'res', name: 'Restaurantes y salidas', amount: 140, deltaVsPrevWeek: 80 })
    expect(withPrev.topCategories[1].deltaVsPrevWeek).toBe(20)
    expect(withPrev.insight).toEqual({ kind: 'category_up', params: { category: 'Restaurantes y salidas', amount: 80 } })
    const noPrev = computeWeeklySnapshot({ weekStart: W, categories: cats, budgets: octBudget, txs: thisWeek })
    expect(noPrev.topCategories[0].deltaVsPrevWeek).toBeNull()
    expect(noPrev.insight.kind).toBe('none')
  })

  it('semana dispersa con menos de 3 movimientos', () => {
    expect(computeWeeklySnapshot({ weekStart: W, categories: cats, budgets: octBudget, txs: [tx('2026-10-05', 10), tx('2026-10-06', 10)] }).isSparse).toBe(true)
    expect(computeWeeklySnapshot({ weekStart: W, categories: cats, budgets: octBudget, txs: [tx('2026-10-05', 10), tx('2026-10-06', 10), tx('2026-10-07', 1)] }).isSparse).toBe(false)
  })
})

describe('averagePreviousWeeks', () => {
  it('promedia solo semanas completas previas con datos y sin fijos', () => {
    const txs = [tx('2026-09-28', 100), tx('2026-09-21', 300), tx('2026-09-22', 3000, 'viv'), tx('2026-10-05', 999)]
    expect(averagePreviousWeeks(txs, cats, W)).toBe(200)
    expect(averagePreviousWeeks([], cats, W)).toBeNull()
  })
})
