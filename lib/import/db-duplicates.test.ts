import { describe, it, expect } from 'vitest'
import { flagDbDuplicates, shiftDate } from './db-duplicates'

describe('shiftDate', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('returns null for malformed dates', () => {
    expect(shiftDate('15/05/2026', 1)).toBeNull()
    expect(shiftDate('', 0)).toBeNull()
  })
})

describe('flagDbDuplicates', () => {
  const existing = [
    { date: '2026-05-14', amount: '450.00' },
    { date: '2026-05-01', amount: 35.5 },
  ]

  it('matches exact amount within ±1 day', () => {
    expect(flagDbDuplicates([
      { date: '2026-05-13', amount: 450 },
      { date: '2026-05-14', amount: 450 },
      { date: '2026-05-15', amount: 450 },
      { date: '2026-05-16', amount: 450 },
      { date: '2026-04-30', amount: 35.5 },
    ], existing)).toEqual([true, true, true, false, true])
  })

  it('does not match a different amount or a malformed date', () => {
    expect(flagDbDuplicates([
      { date: '2026-05-14', amount: 450.01 },
      { date: 'mayo 14', amount: 450 },
    ], existing)).toEqual([false, false])
  })
})
