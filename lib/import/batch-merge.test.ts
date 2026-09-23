import { describe, it, expect } from 'vitest'
import { mergeBatchResults, normalizeDescription, type ExtractedTx } from './batch-merge'
import { computeTargetSize } from './image-compress'

function tx(sourceImageIndex: number, date: string, description: string, amount: number, type: 'expense' | 'income' = 'expense'): ExtractedTx {
  return {
    sourceImageIndex,
    date,
    description,
    amount,
    type,
    suggested_category: 'Alimentación',
    category_id: 'cat-1',
    original_amount: null,
    original_currency: null,
  }
}

describe('normalizeDescription', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeDescription('  CAFÉ   Barista\tZona 10 ')).toBe('cafe barista zona 10')
  })
})

describe('mergeBatchResults', () => {
  it('returns an empty result for an empty batch', () => {
    expect(mergeBatchResults([])).toEqual({ transactions: [], exactDuplicatesCollapsed: 0, possibleDuplicateCount: 0 })
    expect(mergeBatchResults([[], []]).transactions).toEqual([])
  })

  it('leaves a single-photo batch equal to the current single-image result', () => {
    const photo = [
      tx(0, '2026-05-15', 'Super La Torre', 450),
      tx(0, '2026-05-14', 'Uber', 35.5),
      tx(0, '2026-05-10', 'Salario', 8000, 'income'),
    ]
    const result = mergeBatchResults([photo])
    expect(result.exactDuplicatesCollapsed).toBe(0)
    expect(result.possibleDuplicateCount).toBe(0)
    expect(result.transactions.map(t => [t.date, t.description, t.amount, t.type])).toEqual(
      photo.map(t => [t.date, t.description, t.amount, t.type]),
    )
    expect(result.transactions.every(t => t.sourceImageIndexes.length === 1 && t.sourceImageIndexes[0] === 0)).toBe(true)
    expect(result.transactions[0]).not.toHaveProperty('sourceImageIndex')
  })

  it('collapses the overlap between consecutive screenshots and records both sources', () => {
    const photo1 = [
      tx(0, '2026-05-15', 'Super La Torre', 450),
      tx(0, '2026-05-14', 'Uber', 35.5),
      tx(0, '2026-05-13', 'Farmacia Galeno', 120),
    ]
    const photo2 = [
      tx(1, '2026-05-13', 'FARMACIA  GALENO', 120),
      tx(1, '2026-05-12', 'Netflix', 99),
    ]
    const result = mergeBatchResults([photo1, photo2])
    expect(result.transactions).toHaveLength(4)
    expect(result.exactDuplicatesCollapsed).toBe(1)
    const farmacia = result.transactions.find(t => t.amount === 120)!
    expect(farmacia.sourceImageIndexes).toEqual([0, 1])
    expect(farmacia.possibleBatchDuplicate).toBe(false)
    expect(result.transactions.map(t => t.date)).toEqual(['2026-05-15', '2026-05-14', '2026-05-13', '2026-05-12'])
  })

  it('never collapses two identical purchases from the same photo', () => {
    const photo = [
      tx(0, '2026-05-15', 'Parqueo', 15),
      tx(0, '2026-05-15', 'Parqueo', 15),
    ]
    const result = mergeBatchResults([photo])
    expect(result.transactions).toHaveLength(2)
    expect(result.exactDuplicatesCollapsed).toBe(0)
    expect(result.possibleDuplicateCount).toBe(0)
  })

  it('maps repeated identical purchases onto the next photo one-to-one', () => {
    const photo1 = [tx(0, '2026-05-15', 'Parqueo', 15), tx(0, '2026-05-15', 'Parqueo', 15)]
    const photo2 = [tx(1, '2026-05-15', 'Parqueo', 15)]
    const photo3 = [tx(2, '2026-05-15', 'Parqueo', 15), tx(2, '2026-05-15', 'Parqueo', 15), tx(2, '2026-05-15', 'Parqueo', 15)]
    const result = mergeBatchResults([photo1, photo2, photo3])
    expect(result.transactions).toHaveLength(3)
    expect(result.transactions.map(t => t.sourceImageIndexes)).toEqual([[0, 1, 2], [0, 2], [2]])
  })

  it('flags near duplicates across photos without collapsing them', () => {
    const photo1 = [tx(0, '2026-05-13', 'SUPERMERCADO LA TORRE Z10', 450)]
    const photo2 = [tx(1, '2026-05-13', 'Supermercado La Torre', 450)]
    const result = mergeBatchResults([photo1, photo2])
    expect(result.transactions).toHaveLength(2)
    expect(result.exactDuplicatesCollapsed).toBe(0)
    expect(result.possibleDuplicateCount).toBe(2)
    const [a, b] = result.transactions
    expect(a.possibleBatchDuplicate && b.possibleBatchDuplicate).toBe(true)
    expect(a.possibleDuplicateOf).toEqual([b.key])
    expect(b.possibleDuplicateOf).toEqual([a.key])
  })

  it('does not flag unrelated descriptions or same-photo lines as near duplicates', () => {
    const photo1 = [
      tx(0, '2026-05-13', 'Gasolinera Puma', 200),
      tx(0, '2026-05-13', 'Gasolinera Puma Z11', 200),
    ]
    const photo2 = [tx(1, '2026-05-13', 'Cinepolis', 200)]
    const result = mergeBatchResults([photo1, photo2])
    expect(result.transactions).toHaveLength(3)
    expect(result.possibleDuplicateCount).toBe(0)
  })

  it('does not merge an expense with an income of the same amount', () => {
    const result = mergeBatchResults([
      [tx(0, '2026-05-13', 'Transferencia', 500, 'expense')],
      [tx(1, '2026-05-13', 'Transferencia', 500, 'income')],
    ])
    expect(result.transactions).toHaveLength(2)
    expect(result.possibleDuplicateCount).toBe(0)
  })
})

describe('computeTargetSize', () => {
  it('keeps small images untouched', () => {
    expect(computeTargetSize(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('scales the longest side down to maxSide', () => {
    expect(computeTargetSize(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(computeTargetSize(4000, 1000, 1600)).toEqual({ width: 1600, height: 400 })
  })
})
