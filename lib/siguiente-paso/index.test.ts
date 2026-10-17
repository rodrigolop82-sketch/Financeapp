import { describe, it, expect } from 'vitest'
import { calculateScore, type ScoreInput } from '../score-calculator'
import { aplicarPaso, categoriasPasadas, round50, siguientesPasos, MAX_PASOS, type PasosContexto } from './index'

// Cuenta tipo QA: puntaje alto, sin deudas, buen fondo y gasto en línea.
const alto: ScoreInput = {
  income: 20000, saved: 5000, debtPayments: 0, emergencyFund: 80000, fixedExpenses: 10000,
  spent: 9000, planned: 15000, incomeType: 'fixed', incomeVariation: 0.05, hasDebts: false,
}

// Deuda y fondo bajo.
const apretado: ScoreInput = {
  income: 10000, saved: 300, debtPayments: 2500, emergencyFund: 2000, fixedExpenses: 6000,
  spent: 7200, planned: 7000, incomeType: 'fixed', incomeVariation: 0.05, emergencyGoalId: 'g1', hasDebts: true,
}

const ctxApretado: PasosContexto = {
  debts: [
    { id: 'v', name: 'Visa', balance: 9000, interest_rate: 36, min_payment: 450 },
    { id: 'c', name: 'Carro', balance: 60000, interest_rate: 12, min_payment: 2050 },
  ],
  overCategories: [{ id: 'sal', name: 'Salidas', excess: 600 }],
}

describe('siguientesPasos', () => {
  it('puntaje alto y nada que mejorar: no inventa un paso', () => {
    expect(calculateScore(alto).total).toBeGreaterThanOrEqual(95)
    expect(siguientesPasos(alto, { debts: [], overCategories: [] })).toEqual([])
  })

  it('sin ingreso no hay pasos', () => {
    expect(siguientesPasos({ ...apretado, income: 0 }, ctxApretado)).toEqual([])
  })

  it('con deuda y fondo bajo: hasta tres pasos coherentes', () => {
    const pasos = siguientesPasos(apretado, ctxApretado)
    expect(pasos.length).toBeGreaterThan(0)
    expect(pasos.length).toBeLessThanOrEqual(MAX_PASOS)
    for (const p of pasos) {
      expect(p.gain).toBeGreaterThanOrEqual(1)
      expect(p.from).toBe(calculateScore(apretado).total)
      expect(p.cambios.find((c) => c.key === p.component)!.to).toBeGreaterThan(p.cambios.find((c) => c.key === p.component)!.from)
      expect(p.cambios.reduce((s, c) => s + c.to - c.from, 0)).toBe(p.gain)
    }
    expect(pasos.map((p) => p.key)).toContain('emergency')
  })

  it('el efecto estimado coincide con recalcular el puntaje con ese cambio', () => {
    for (const p of siguientesPasos(apretado, ctxApretado)) {
      const debt = ctxApretado.debts.find((d) => d.id === p.targetId)
      const next = aplicarPaso(apretado, p.key, p.amount, { minPayment: debt ? Number(debt.min_payment) : 0 })
      expect(p.to).toBe(calculateScore(next).total)
    }
  })

  it('la deuda del paso es la de mayor interés', () => {
    const debt = siguientesPasos(apretado, ctxApretado).find((p) => p.key === 'debt')
    if (debt) expect(debt.name).toBe('Visa')
  })

  it('no modifica las entradas', () => {
    const copy = { ...apretado }
    siguientesPasos(apretado, ctxApretado)
    expect(apretado).toEqual(copy)
  })

  it('Estabilidad de ingreso nunca genera pasos', () => {
    const variable: ScoreInput = { ...alto, incomeType: 'variable', incomeVariation: 0.6 }
    expect(siguientesPasos(variable, { debts: [], overCategories: [] }).every((p) => p.component !== 'stability')).toBe(true)
  })
})

describe('aplicarPaso', () => {
  it('aportar al fondo sube el fondo, no el ahorro del mes (ya está dentro)', () => {
    const n = aplicarPaso(apretado, 'emergency', 1000)
    expect(n.emergencyFund).toBe(3000)
    expect(n.saved).toBe(apretado.saved)
  })
  it('sin ingresos registrados no sugiere ahorrar más', () => {
    const pasos = siguientesPasos({ ...apretado, provisional: true }, { debts: [], overCategories: [] })
    expect(pasos.every((p) => p.component !== 'savings')).toBe(true)
  })
  it('terminar una deuda quita su cuota', () => {
    expect(aplicarPaso(apretado, 'debt', 9000, { minPayment: 450 }).debtPayments).toBe(2050)
  })
})

describe('categoriasPasadas', () => {
  it('solo básico y gustos que pasaron su plan, de mayor a menor exceso', () => {
    const cats = [
      { id: 'a', name: 'Súper', bucket: 'needs' as const, budgeted_amount: 1000 },
      { id: 'b', name: 'Salidas', bucket: 'wants' as const, budgeted_amount: 500 },
      { id: 'c', name: 'Ahorro', bucket: 'savings' as const, budgeted_amount: 100 },
      { id: 'd', name: 'Ropa', bucket: 'wants' as const, budgeted_amount: 0 },
    ]
    const txs = [
      { amount: 1100, type: 'expense' as const, category_id: 'a', date: '2026-10-03' },
      { amount: 900, type: 'expense' as const, category_id: 'b', date: '2026-10-05' },
      { amount: 999, type: 'expense' as const, category_id: 'c', date: '2026-10-05' },
      { amount: 300, type: 'expense' as const, category_id: 'd', date: '2026-10-05' },
      { amount: 5000, type: 'expense' as const, category_id: 'b', date: '2026-09-30' },
    ]
    expect(categoriasPasadas(cats, [], txs, '2026-10')).toEqual([
      { id: 'b', name: 'Salidas', excess: 400 },
      { id: 'a', name: 'Súper', excess: 100 },
    ])
  })
})

it('round50', () => {
  expect(round50(0)).toBe(0)
  expect(round50(1)).toBe(50)
  expect(round50(1000)).toBe(1000)
  expect(round50(1001)).toBe(1050)
})
