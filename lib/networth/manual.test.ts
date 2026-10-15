import { describe, it, expect } from 'vitest'
import { mergeManualHistory, validateManualMonth } from './manual'

const computed = [
  { month: '2026-07', netWorth: 100 },
  { month: '2026-08', netWorth: 120 },
  { month: '2026-09', netWorth: 150 },
]

describe('mergeManualHistory', () => {
  it('sin meses manuales: la serie calculada tal cual', () => {
    expect(mergeManualHistory(computed, [], '2026-10')).toEqual(computed.map((p) => ({ ...p, origin: 'auto' })))
  })

  it('el dato manual gana sobre el calculado del mismo mes', () => {
    const r = mergeManualHistory(computed, [{ month: '2026-08', assets: 500, liabilities: 200 }], '2026-10')
    expect(r.find((p) => p.month === '2026-08')).toEqual({ month: '2026-08', netWorth: 300, origin: 'manual', assets: 500, liabilities: 200 })
    expect(r).toHaveLength(3)
  })

  it('agrega meses de antes de usar Zafi, en orden', () => {
    const r = mergeManualHistory(computed, [{ month: '2024-12', assets: 50, liabilities: 80 }], '2026-10')
    expect(r.map((p) => p.month)).toEqual(['2024-12', '2026-07', '2026-08', '2026-09'])
    expect(r[0].netWorth).toBe(-30)
  })

  it('ignora meses manuales del mes en curso o futuros', () => {
    const r = mergeManualHistory(computed, [{ month: '2026-10', assets: 1, liabilities: 0 }], '2026-10')
    expect(r.map((p) => p.month)).toEqual(['2026-07', '2026-08', '2026-09'])
  })
})

describe('validateManualMonth', () => {
  it('acepta un mes cerrado con montos válidos', () => {
    expect(validateManualMonth({ month: '2023-03', assets: 1000, liabilities: 0 }, '2026-10')).toBeNull()
  })
  it('rechaza el mes en curso y los futuros', () => {
    expect(validateManualMonth({ month: '2026-10', assets: 1, liabilities: 1 }, '2026-10')).toMatch(/cerraron/)
  })
  it('rechaza meses mal escritos o demasiado antiguos', () => {
    expect(validateManualMonth({ month: '2026-13', assets: 1, liabilities: 1 }, '2026-10')).not.toBeNull()
    expect(validateManualMonth({ month: '1970-01', assets: 1, liabilities: 1 }, '2026-10')).not.toBeNull()
  })
  it('rechaza montos negativos o que no son números', () => {
    expect(validateManualMonth({ month: '2025-01', assets: -1, liabilities: 0 }, '2026-10')).not.toBeNull()
    expect(validateManualMonth({ month: '2025-01', assets: '100', liabilities: 0 }, '2026-10')).not.toBeNull()
  })
})
