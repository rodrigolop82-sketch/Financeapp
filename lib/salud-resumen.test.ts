import { describe, expect, it } from 'vitest'
import { mejorParte } from './salud-resumen'
import { calculateScore, type ScoreInput } from './score-calculator'

const base: ScoreInput = {
  income: 12000, saved: 900, debtPayments: 0, emergencyFund: 9250, fixedExpenses: 5110,
  spent: 7000, planned: 9800, incomeType: 'fixed', incomeVariation: null,
}

describe('mejorParte', () => {
  it('la parte más llena', () => {
    expect(mejorParte(calculateScore(base).components)?.key).toBe('debt')
  })
  it('nunca una pendiente (ahorro sin ingresos)', () => {
    const r = calculateScore({ ...base, provisional: true, debtPayments: 5000 })
    expect(mejorParte(r.components)?.pending).toBeFalsy()
  })
  it('sin partes, null', () => {
    expect(mejorParte([])).toBeNull()
  })
})
