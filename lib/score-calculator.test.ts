import { describe, it, expect } from 'vitest'
import { calculateScore, lerp, partColor, scoreFromProfile, type ScoreInput } from './score-calculator'
import { buildScoreInput, incomeVariation, type ScoreRaw } from './health-data'

const base: ScoreInput = {
  income: 12000, saved: 900, debtPayments: 2050, emergencyFund: 9250, fixedExpenses: 5110,
  spent: 7000, planned: 9800, incomeType: 'mixed', incomeVariation: null,
}

describe('lerp', () => {
  it('interpola y se queda plano fuera del tramo', () => {
    expect(lerp(0.1, 0, 0.2, 2, 20)).toBeCloseTo(11)
    expect(lerp(-1, 0, 0.2, 2, 20)).toBe(2)
    expect(lerp(1, 0, 0.2, 2, 20)).toBe(20)
    expect(lerp(0.2, 0.4, 0, 2, 20)).toBeCloseTo(11)
  })
})

describe('calculateScore', () => {
  it('suma 5 partes de 20 y pone etiqueta', () => {
    const r = calculateScore(base)
    expect(r.components).toHaveLength(5)
    expect(r.total).toBe(r.components.reduce((s, c) => s + c.score, 0))
    expect(r.components.every((c) => c.max === 20 && c.score >= 2 && c.score <= 20)).toBe(true)
  })

  it('cada aporte mueve el número (puntaje continuo)', () => {
    const a = calculateScore(base).total
    const b = calculateScore({ ...base, saved: base.saved + 600 }).total
    expect(b).toBeGreaterThan(a)
  })

  it('la deuda cuenta la cuota, no el saldo', () => {
    const none = calculateScore({ ...base, debtPayments: 0 })
    expect(none.components.find((c) => c.key === 'debt')!.score).toBe(20)
    const heavy = calculateScore({ ...base, debtPayments: 12000 * 0.4 })
    expect(heavy.components.find((c) => c.key === 'debt')!.score).toBe(2)
  })

  it('gastar de más que el plan baja la parte de gasto', () => {
    const ok = calculateScore({ ...base, spent: 5000 }).components.find((c) => c.key === 'spending')!.score
    const over = calculateScore({ ...base, spent: 11000 }).components.find((c) => c.key === 'spending')!.score
    expect(ok).toBe(20)
    expect(over).toBe(2)
  })

  it('sin ingreso no hay puntaje', () => {
    expect(calculateScore({ ...base, income: 0 }).total).toBe(0)
  })

  it('la acción del fondo lleva a la meta si existe', () => {
    const r = calculateScore({ ...base, emergencyGoalId: 'g1' })
    expect(r.components.find((c) => c.key === 'emergency')!.action?.href).toBe('/metas/g1?from=score')
  })

  it('etiquetas y colores', () => {
    expect(calculateScore({ ...base, saved: 3000, debtPayments: 0, emergencyFund: 40000, spent: 1000, incomeType: 'fixed' }).label).toBe('Excelente')
    expect(partColor(16, 20)).toBe('#10B981')
    expect(partColor(5, 20)).toBe('#EF4444')
  })
})

describe('scoreFromProfile (semilla del onboarding)', () => {
  it('usa las cuotas si se conocen', () => {
    const p = { total_income: 10000, total_fixed_expenses: 5000, total_debt: 20000, total_savings: 2000, has_emergency_fund: false, income_type: 'fixed' as const }
    const withPayments = scoreFromProfile(p, 500)
    const estimated = scoreFromProfile(p)
    expect(withPayments.components.find((c) => c.key === 'debt')!.detail).toContain('Q 500')
    expect(estimated.components.find((c) => c.key === 'debt')!.detail).toContain('Q 600')
  })
})

describe('buildScoreInput (datos vivos)', () => {
  const raw: ScoreRaw = {
    month: '2026-10',
    profile: { total_income: 9000, total_fixed_expenses: 4000, total_savings: 1500, income_type: 'mixed' },
    categories: [
      { id: 'n', name: 'Renta', bucket: 'needs', budgeted_amount: 3500, pace_mode: 'fixed' },
      { id: 'w', name: 'Salidas', bucket: 'wants', budgeted_amount: 600 },
      { id: 's', name: 'Ahorro', bucket: 'savings', budgeted_amount: 1000 },
    ],
    subItems: [],
    incomes: [{ id: 'i', source: 'Salario', amount: 12000, frequency: 'monthly' } as never],
    txs: [
      { amount: 3500, type: 'expense', category_id: 'n', date: '2026-10-01' },
      { amount: 200, type: 'expense', category_id: 'w', date: '2026-10-03' },
      { amount: 700, type: 'expense', category_id: 's', date: '2026-10-04' },
      { amount: 999, type: 'expense', category_id: 'w', date: '2026-09-20' },
    ],
    contributions: 300,
    emergencyGoal: { id: 'g', current_amount: 8000 },
    debts: [{ min_payment: 450 }, { min_payment: 1100 }],
  }

  it('toma ingreso y plan del Plan del mes, y lo ahorrado de aportes + categorías de ahorro', () => {
    const i = buildScoreInput(raw)
    expect(i.income).toBe(12000)
    expect(i.saved).toBe(1000)
    expect(i.spent).toBe(3700)
    expect(i.planned).toBe(4100)
    expect(i.fixedExpenses).toBe(3500)
    expect(i.debtPayments).toBe(1550)
    expect(i.emergencyFund).toBe(8000)
    expect(i.emergencyGoalId).toBe('g')
  })

  it('sin plan usa el onboarding', () => {
    const i = buildScoreInput({ ...raw, categories: [], incomes: [], emergencyGoal: null })
    expect(i.income).toBe(9000)
    expect(i.fixedExpenses).toBe(4000)
    expect(i.emergencyFund).toBe(1500)
  })

  it('mide cuánto varían los ingresos de los 3 meses anteriores', () => {
    const txs = [
      { amount: 6000, type: 'income' as const, category_id: null, date: '2026-09-15' },
      { amount: 6000, type: 'income' as const, category_id: null, date: '2026-08-15' },
      { amount: 6000, type: 'income' as const, category_id: null, date: '2026-07-15' },
    ]
    expect(incomeVariation(txs, '2026-10')).toBe(0)
    expect(incomeVariation(txs.slice(0, 1), '2026-10')).toBeNull()
  })
})
