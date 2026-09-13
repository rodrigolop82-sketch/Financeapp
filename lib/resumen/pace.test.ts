import { describe, it, expect } from 'vitest'
import {
  computeCategoryPace,
  summarizeMonth,
  type CategoryBudgetInput,
  type MonthContext,
} from './pace'

function makeCtx(day: number, daysInMonth = 30): MonthContext {
  return {
    today: new Date(2026, 8, day),
    daysInMonth,
    dayOfMonth: day,
  }
}

function makeInput(overrides: Partial<CategoryBudgetInput> = {}): CategoryBudgetInput {
  return {
    categoryId: 'cat-1',
    name: 'Alimentación',
    budget: 3000,
    spent: 1500,
    paceMode: 'linear',
    expectedDay: null,
    ...overrides,
  }
}

describe('computeCategoryPace', () => {
  it('linear — en riesgo when projection exceeds budget by >5%', () => {
    const ctx = makeCtx(10, 30)
    const input = makeInput({ budget: 3000, spent: 1500 })
    const result = computeCategoryPace(input, ctx)

    expect(result.pctOfMonthElapsed).toBeCloseTo(10 / 30)
    expect(result.expected).toBeCloseTo(1000)
    expect(result.projection).toBeCloseTo(4500)
    expect(result.status).toBe('riesgo')
  })

  it('linear — sobregiro when spent > budget', () => {
    const ctx = makeCtx(20, 30)
    const input = makeInput({ budget: 3000, spent: 3500 })
    const result = computeCategoryPace(input, ctx)

    expect(result.status).toBe('sobregiro')
    expect(result.overrun).toBe(500)
    expect(result.remaining).toBe(0)
  })

  it('linear — en_linea when on track', () => {
    const ctx = makeCtx(15, 30)
    const input = makeInput({ budget: 3000, spent: 1500 })
    const result = computeCategoryPace(input, ctx)

    expect(result.projection).toBeCloseTo(3000)
    expect(result.status).toBe('en_linea')
  })

  it('linear — sin_gasto when spent = 0', () => {
    const ctx = makeCtx(15, 30)
    const input = makeInput({ spent: 0 })
    const result = computeCategoryPace(input, ctx)

    expect(result.status).toBe('sin_gasto')
    expect(result.projection).toBe(0)
  })

  it('fixed — before expected day, not yet paid', () => {
    const ctx = makeCtx(10, 30)
    const input = makeInput({ paceMode: 'fixed', expectedDay: 15, spent: 0 })
    const result = computeCategoryPace(input, ctx)

    expect(result.expected).toBe(0)
    expect(result.projection).toBe(3000)
    expect(result.status).toBe('sin_gasto')
  })

  it('fixed — after expected day, paid correctly', () => {
    const ctx = makeCtx(20, 30)
    const input = makeInput({ paceMode: 'fixed', expectedDay: 15, spent: 3000 })
    const result = computeCategoryPace(input, ctx)

    expect(result.expected).toBe(3000)
    expect(result.projection).toBe(3000)
    expect(result.status).toBe('en_linea')
  })

  it('fixed — after expected day, overspent', () => {
    const ctx = makeCtx(20, 30)
    const input = makeInput({ paceMode: 'fixed', expectedDay: 15, spent: 4000 })
    const result = computeCategoryPace(input, ctx)

    expect(result.status).toBe('sobregiro')
    expect(result.overrun).toBe(1000)
  })

  it('fixed — never produces riesgo status', () => {
    const ctx = makeCtx(20, 30)
    const input = makeInput({ paceMode: 'fixed', expectedDay: 15, spent: 2900 })
    const result = computeCategoryPace(input, ctx)

    expect(result.status).toBe('en_linea')
  })

  it('fixed — null expectedDay treated as day 1', () => {
    const ctx = makeCtx(5, 30)
    const input = makeInput({ paceMode: 'fixed', expectedDay: null, spent: 3000 })
    const result = computeCategoryPace(input, ctx)

    expect(result.expected).toBe(3000)
    expect(result.status).toBe('en_linea')
  })

  it('budget = 0 with spent > 0 → sobregiro with overrun = spent', () => {
    const ctx = makeCtx(15, 30)
    const input = makeInput({ budget: 0, spent: 500 })
    const result = computeCategoryPace(input, ctx)

    expect(result.status).toBe('sobregiro')
    expect(result.overrun).toBe(500)
  })

  it('day 1 of month', () => {
    const ctx = makeCtx(1, 31)
    const input = makeInput({ budget: 3100, spent: 100 })
    const result = computeCategoryPace(input, ctx)

    expect(result.pctOfMonthElapsed).toBeCloseTo(1 / 31)
    expect(result.expected).toBeCloseTo(100)
    expect(result.projection).toBeCloseTo(3100)
    expect(result.status).toBe('en_linea')
  })

  it('last day of month', () => {
    const ctx = makeCtx(31, 31)
    const input = makeInput({ budget: 3100, spent: 3000 })
    const result = computeCategoryPace(input, ctx)

    expect(result.pctOfMonthElapsed).toBeCloseTo(1)
    expect(result.expected).toBeCloseTo(3100)
    expect(result.projection).toBeCloseTo(3000)
    expect(result.status).toBe('en_linea')
  })
})

describe('summarizeMonth', () => {
  it('all ok → ok verdict', () => {
    const ctx = makeCtx(15, 30)
    const items = [
      computeCategoryPace(makeInput({ categoryId: 'a', name: 'A', budget: 3000, spent: 1500 }), ctx),
      computeCategoryPace(makeInput({ categoryId: 'b', name: 'B', budget: 2000, spent: 1000 }), ctx),
    ]
    const summary = summarizeMonth(items, ctx)

    expect(summary.verdict.tone).toBe('ok')
    expect(summary.verdict.headline).toBe('Vas en línea con tu presupuesto')
    expect(summary.totalBudget).toBe(5000)
    expect(summary.totalSpent).toBe(2500)
    expect(summary.available).toBe(2500)
    expect(summary.overCategories).toHaveLength(0)
    expect(summary.riskCategories).toHaveLength(0)
  })

  it('has sobregiro → danger verdict', () => {
    const ctx = makeCtx(20, 30)
    const items = [
      computeCategoryPace(makeInput({ categoryId: 'a', name: 'A', budget: 3000, spent: 3500 }), ctx),
      computeCategoryPace(makeInput({ categoryId: 'b', name: 'B', budget: 2000, spent: 1000 }), ctx),
    ]
    const summary = summarizeMonth(items, ctx)

    expect(summary.verdict.tone).toBe('danger')
    expect(summary.verdict.headline).toContain('Q 500')
    expect(summary.verdict.headline).toContain('1 categoría')
    expect(summary.overCategories).toHaveLength(1)
    expect(summary.totalOverrun).toBe(500)
  })

  it('has riesgo but no sobregiro → warn verdict', () => {
    const ctx = makeCtx(10, 30)
    const items = [
      computeCategoryPace(makeInput({ categoryId: 'a', name: 'Transporte', budget: 3000, spent: 1500 }), ctx),
      computeCategoryPace(makeInput({ categoryId: 'b', name: 'B', budget: 2000, spent: 500 }), ctx),
    ]
    const summary = summarizeMonth(items, ctx)

    expect(summary.verdict.tone).toBe('warn')
    expect(summary.verdict.headline).toContain('van rápido')
    expect(summary.verdict.sub).toContain('Transporte')
  })

  it('sobregiro + riesgo → danger with risk count in sub', () => {
    const ctx = makeCtx(10, 30)
    const items = [
      computeCategoryPace(makeInput({ categoryId: 'a', name: 'A', budget: 1000, spent: 1200 }), ctx),
      computeCategoryPace(makeInput({ categoryId: 'b', name: 'B', budget: 3000, spent: 1500 }), ctx),
    ]
    const summary = summarizeMonth(items, ctx)

    expect(summary.verdict.tone).toBe('danger')
    expect(summary.verdict.sub).toContain('en riesgo')
  })

  it('okCategories excludes sin_gasto', () => {
    const ctx = makeCtx(15, 30)
    const items = [
      computeCategoryPace(makeInput({ categoryId: 'a', name: 'A', budget: 3000, spent: 1500 }), ctx),
      computeCategoryPace(makeInput({ categoryId: 'b', name: 'B', budget: 2000, spent: 0 }), ctx),
    ]
    const summary = summarizeMonth(items, ctx)

    expect(summary.okCategories).toHaveLength(1)
    expect(summary.okCategories[0].categoryId).toBe('a')
  })
})
