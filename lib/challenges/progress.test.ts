import { describe, it, expect } from 'vitest'
import { baselineDaily, computeProgress, endsAt, type ProgressTx } from './progress'

const exp = (date: string, amount: number, categoryId: string | null = 'res'): ProgressTx => ({ date, amount, categoryId, isExpense: true })

describe('baselineDaily', () => {
  // Julio, agosto y septiembre (31+31+30 = 92 días) con 920 en total ⇒ 10/día.
  const hist = [exp('2026-07-10', 310), exp('2026-08-10', 310), exp('2026-09-10', 300), exp('2026-10-02', 5000)]
  it('usa 3 meses completos y nunca el mes en curso', () => {
    expect(baselineDaily(hist, 'res', '2026-10-11', '2026-06')).toBe(10)
  })
  it('con 2 meses completos + el parcial de inicio, el primero no cuenta', () => {
    // Primer movimiento en julio ⇒ julio está a medias: solo agosto y septiembre (61 días, 610).
    expect(baselineDaily(hist, 'res', '2026-10-11', '2026-07')).toBe(10)
  })
  it('sin un mes completo de historial → null', () => {
    expect(baselineDaily([exp('2026-10-02', 50)], 'res', '2026-10-11', '2026-10')).toBeNull()
    expect(baselineDaily([exp('2026-09-02', 50)], 'res', '2026-10-11', '2026-09')).toBeNull()
  })
})

describe('computeProgress', () => {
  const base = { type: 'spend_reduction' as const, startedAt: '2026-10-01', durationDays: 30, categoryId: 'res', baselineDaily: 20 }

  it('un día con gasto exactamente igual a la línea base cumple; uno mayor no', () => {
    const p = computeProgress(base, [exp('2026-10-01', 20), exp('2026-10-02', 20.01)], '2026-10-03')
    expect(p.completedDays).toEqual([true, false, true])
    expect(p.dayIndex).toBe(3)
  })

  it('ahorro estimado nunca negativo; null sin línea base', () => {
    const over = computeProgress(base, [exp('2026-10-01', 500)], '2026-10-02')
    expect(over.estimatedSavings).toBeNull()
    const under = computeProgress(base, [exp('2026-10-01', 5)], '2026-10-02')
    expect(under.estimatedSavings).toBe(35)
    expect(computeProgress({ ...base, baselineDaily: null }, [], '2026-10-02').estimatedSavings).toBeNull()
  })

  it('racha con huecos y al cruzar fin de mes', () => {
    const c = { type: 'logging_streak' as const, startedAt: '2026-09-27', durationDays: 7, categoryId: null, baselineDaily: null }
    const txs = ['2026-09-27', '2026-09-29', '2026-09-30', '2026-10-01'].map((d) => exp(d, 10, 'ali'))
    const p = computeProgress(c, txs, '2026-10-01')
    expect(p.completedDays).toEqual([true, false, true, true, true])
    expect(p.streak).toBe(3)
    // Hoy aún sin registro: la racha cuenta desde ayer.
    expect(computeProgress(c, txs, '2026-10-02').streak).toBe(3)
  })

  it('pasa a completed después de ends_at', () => {
    expect(endsAt('2026-10-01', 7)).toBe('2026-10-07')
    const c = { type: 'no_spend_category' as const, startedAt: '2026-10-01', durationDays: 7, categoryId: 'res', baselineDaily: null }
    expect(computeProgress(c, [], '2026-10-07').status).toBe('on_track')
    const done = computeProgress(c, [], '2026-10-08')
    expect(done.status).toBe('completed')
    expect(done.daysMet).toBe(7)
    expect(done.dayIndex).toBe(7)
  })

  it('no_spend_category ignora gastos de otra categoría', () => {
    const c = { type: 'no_spend_category' as const, startedAt: '2026-10-01', durationDays: 14, categoryId: 'res', baselineDaily: null }
    const p = computeProgress(c, [exp('2026-10-01', 300, 'ali'), exp('2026-10-02', 45, 'res')], '2026-10-03')
    expect(p.completedDays).toEqual([true, false, true])
  })

  it('off_track con 3 días cerrados seguidos sin cumplir; se puede retomar', () => {
    const c = { type: 'no_spend_category' as const, startedAt: '2026-10-01', durationDays: 14, categoryId: 'res', baselineDaily: null }
    const txs = ['2026-10-02', '2026-10-03', '2026-10-04'].map((d) => exp(d, 50))
    expect(computeProgress(c, txs, '2026-10-05').status).toBe('off_track')
    expect(computeProgress(c, txs, '2026-10-06').status).toBe('on_track')
  })

  it('revisar suscripciones se completa con la revisión', () => {
    const c = { type: 'review_subscriptions' as const, startedAt: '2026-10-01', durationDays: 7, categoryId: null, baselineDaily: null }
    expect(computeProgress(c, [], '2026-10-02').status).toBe('on_track')
    expect(computeProgress(c, [], '2026-10-02', { reviewDone: true }).status).toBe('completed')
  })
})
