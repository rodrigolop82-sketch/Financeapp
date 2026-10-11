import { describe, it, expect } from 'vitest'
import { buildTip, savingsRows } from './tip'

const base = { category: { id: 'res', name: 'Restaurantes' }, status: 'sobregiro' as const, purchases: 9, spent: 1180, overBudget: 380, dismissed: false, activeChallengeInCategory: false }

describe('buildTip', () => {
  it('solo en Sobregiro', () => {
    expect(buildTip(base)).toEqual({ tipKey: 'overspend:res', categoryId: 'res', categoryName: 'Restaurantes', purchases: 9, spent: 1180, overBudget: 380 })
    expect(buildTip({ ...base, status: 'riesgo' })).toBeNull()
  })
  it('no aparece si se descartó este mes o ya hay un reto en la categoría', () => {
    expect(buildTip({ ...base, dismissed: true })).toBeNull()
    expect(buildTip({ ...base, activeChallengeInCategory: true })).toBeNull()
  })
})

describe('savingsRows', () => {
  it('hasta 3 filas sobre presupuesto; suscripciones al final si hay', () => {
    const over = [{ id: 'a', name: 'A', overrun: 100 }, { id: 'b', name: 'B', overrun: 300 }, { id: 'c', name: 'C', overrun: 50 }, { id: 'd', name: 'D', overrun: 10 }]
    expect(savingsRows(over, null).map((r) => r.label)).toEqual(['B', 'A', 'C'])
    expect(savingsRows(over, 655).map((r) => r.label)).toEqual(['B', 'A', 'Suscripciones'])
    expect(savingsRows([], 0)).toEqual([])
  })
})
