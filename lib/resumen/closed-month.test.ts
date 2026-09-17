import { describe, it, expect } from 'vitest'
import {
  computeClosedCategory,
  computeClosedMonth,
  type ClosedCategoryInput,
  type ClosedMonthInput,
} from './closed-month'

function makeCat(overrides: Partial<ClosedCategoryInput> = {}): ClosedCategoryInput {
  return {
    categoryId: 'cat-1',
    name: 'Alimentación',
    budget: 3000,
    spent: 2500,
    ...overrides,
  }
}

describe('computeClosedCategory', () => {
  it('en_linea when spent < budget', () => {
    const result = computeClosedCategory(makeCat({ budget: 3000, spent: 2000 }))
    expect(result.status).toBe('en_linea')
    expect(result.diff).toBe(1000)
    expect(result.pctOfBudget).toBeCloseTo(2000 / 3000)
  })

  it('sobregiro when spent > budget', () => {
    const result = computeClosedCategory(makeCat({ budget: 3000, spent: 3500 }))
    expect(result.status).toBe('sobregiro')
    expect(result.diff).toBe(-500)
  })

  it('sobregiro when budget = 0 and spent > 0', () => {
    const result = computeClosedCategory(makeCat({ budget: 0, spent: 500 }))
    expect(result.status).toBe('sobregiro')
    expect(result.pctOfBudget).toBe(0)
  })

  it('sin_gasto when spent = 0', () => {
    const result = computeClosedCategory(makeCat({ spent: 0 }))
    expect(result.status).toBe('sin_gasto')
    expect(result.diff).toBe(3000)
  })

  it('en_linea when spent = budget exactly', () => {
    const result = computeClosedCategory(makeCat({ budget: 3000, spent: 3000 }))
    expect(result.status).toBe('en_linea')
    expect(result.diff).toBe(0)
    expect(result.pctOfBudget).toBe(1)
  })

  it('never produces riesgo status', () => {
    const inputs = [
      makeCat({ budget: 3000, spent: 2900 }),
      makeCat({ budget: 3000, spent: 2999 }),
      makeCat({ budget: 3000, spent: 1500 }),
      makeCat({ budget: 3000, spent: 3001 }),
    ]
    for (const input of inputs) {
      const result = computeClosedCategory(input)
      expect(result.status).not.toBe('riesgo')
    }
  })
})

describe('computeClosedMonth', () => {
  it('ok tone when well under budget', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', name: 'A', budget: 3000, spent: 2000 }),
        makeCat({ categoryId: 'b', name: 'B', budget: 2000, spent: 1000 }),
      ],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.tone).toBe('ok')
    expect(result.totalBudget).toBe(5000)
    expect(result.totalSpent).toBe(3000)
    expect(result.available).toBe(2000)
    expect(result.overrun).toBe(0)
    expect(result.headline).toContain('sobrante')
    expect(result.headline).toContain('Q 2,000')
  })

  it('bad tone when over budget', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', name: 'A', budget: 3000, spent: 3500 }),
        makeCat({ categoryId: 'b', name: 'B', budget: 2000, spent: 2200 }),
      ],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.tone).toBe('bad')
    expect(result.overrun).toBe(700)
    expect(result.available).toBe(0)
    expect(result.headline).toContain('sobregiro')
    expect(result.overCategories).toHaveLength(2)
  })

  it('warn tone when diff < 5% of budget', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', name: 'A', budget: 10000, spent: 9600 }),
      ],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.tone).toBe('warn')
    expect(result.headline).toContain('ajustado')
  })

  it('category sorting: sobregiro by worst diff, ok by highest spent', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', name: 'A', budget: 1000, spent: 1200 }),
        makeCat({ categoryId: 'b', name: 'B', budget: 2000, spent: 2500 }),
        makeCat({ categoryId: 'c', name: 'C', budget: 3000, spent: 2000 }),
        makeCat({ categoryId: 'd', name: 'D', budget: 1500, spent: 1000 }),
      ],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.overCategories[0].categoryId).toBe('b')
    expect(result.overCategories[1].categoryId).toBe('a')
    expect(result.okCategories[0].categoryId).toBe('c')
    expect(result.okCategories[1].categoryId).toBe('d')
  })

  it('computes average from previous months', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', budget: 5000, spent: 4000 }),
      ],
      prevMonthsSpent: [3000, 3500, 4500],
    }
    const result = computeClosedMonth(input)

    expect(result.avgPrevMonths).toBe(Math.round((3000 + 3500 + 4500) / 3))
    expect(result.diffVsAvg).toBe(4000 - result.avgPrevMonths!)
    expect(result.diffVsAvgPct).toBe(Math.round((result.diffVsAvg! / result.avgPrevMonths!) * 100))
  })

  it('no averages when prevMonthsSpent is empty', () => {
    const input: ClosedMonthInput = {
      categories: [makeCat({ budget: 5000, spent: 3000 })],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.avgPrevMonths).toBeNull()
    expect(result.diffVsAvg).toBeNull()
    expect(result.diffVsAvgPct).toBeNull()
  })

  it('skips zero-value previous months in avg calculation', () => {
    const input: ClosedMonthInput = {
      categories: [makeCat({ budget: 5000, spent: 4000 })],
      prevMonthsSpent: [3000, 0, 4000],
    }
    const result = computeClosedMonth(input)

    expect(result.avgPrevMonths).toBe(Math.round((3000 + 4000) / 2))
  })

  it('handles all zero budgets gracefully', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', budget: 0, spent: 500 }),
      ],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.tone).toBe('bad')
    expect(result.totalBudget).toBe(0)
    expect(result.overrun).toBe(500)
  })

  it('noSpendCategories contains only sin_gasto', () => {
    const input: ClosedMonthInput = {
      categories: [
        makeCat({ categoryId: 'a', name: 'A', budget: 3000, spent: 2000 }),
        makeCat({ categoryId: 'b', name: 'B', budget: 2000, spent: 0 }),
        makeCat({ categoryId: 'c', name: 'C', budget: 1000, spent: 0 }),
      ],
      prevMonthsSpent: [],
    }
    const result = computeClosedMonth(input)

    expect(result.noSpendCategories).toHaveLength(2)
    expect(result.okCategories).toHaveLength(1)
  })
})
