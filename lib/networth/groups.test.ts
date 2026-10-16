import { describe, it, expect } from 'vitest'
import { groupAssets, groupLiabilities, liabilityTerm, type DebtTerms } from './groups'

const terms = (t: Partial<DebtTerms>): DebtTerms => ({
  debtType: 'loan', purpose: null, interestRate: 0, monthlyPayment: 0, dueDay: null, originalAmount: null, monthsLeft: null, ...t,
})

describe('groupAssets', () => {
  it('ordena por liquidez, suma saldos y omite grupos vacíos', () => {
    const groups = groupAssets([
      { kind: 'real_estate' as const, balance: 700000 },
      { kind: 'bank_account' as const, balance: 42300 },
      { kind: 'vehicle' as const, balance: 165000 },
      { kind: 'cash' as const, balance: 7500 },
      { kind: 'bank_account' as const, balance: null },
    ])
    expect(groups.map((g) => [g.id, g.total, g.items.length])).toEqual([
      ['cash', 49800, 3],
      ['vehicles', 165000, 1],
      ['real_estate', 700000, 1],
    ])
  })
})

describe('liabilityTerm', () => {
  it('tarjetas e informales son de corto plazo', () => {
    expect(liabilityTerm(terms({ debtType: 'credit', monthsLeft: 40 }))).toBe('short')
    expect(liabilityTerm(terms({ debtType: 'informal' }))).toBe('short')
  })
  it('un préstamo es de largo plazo salvo que le falte un año o menos', () => {
    expect(liabilityTerm(terms({ monthsLeft: 31, purpose: 'vehicle' }))).toBe('long')
    expect(liabilityTerm(terms({ monthsLeft: 12 }))).toBe('short')
    expect(liabilityTerm(terms({ monthsLeft: null }))).toBe('long')
  })
  it('una deuda sin datos de Plan › Deudas va en otras', () => {
    expect(liabilityTerm(null)).toBe('other')
  })
})

describe('groupLiabilities', () => {
  it('suma saldos y pagos mensuales por plazo', () => {
    const groups = groupLiabilities([
      { kind: 'credit_card' as const, balance: 12300, debtTerms: terms({ debtType: 'credit', monthlyPayment: 1200 }) },
      { kind: 'loan' as const, balance: 92000, debtTerms: terms({ monthsLeft: 31, monthlyPayment: 3450 }) },
      { kind: 'other_liability' as const, balance: 5000 },
      { kind: 'loan' as const, balance: 320000, debtTerms: terms({ monthsLeft: 200, monthlyPayment: 3500 }) },
    ])
    expect(groups.map((g) => [g.id, g.total, g.monthly])).toEqual([
      ['short', 12300, 1200],
      ['long', 412000, 6950],
      ['other', 5000, 0],
    ])
  })
})
