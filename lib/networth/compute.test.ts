import { describe, it, expect } from 'vitest'
import { daysSince, isStale, monthlyHistory, prevMonthEnd, summarize, type BalancePoint, type NetWorthItem } from './compute'

const NOW = '2026-10-11T18:00:00Z'
const item = (id: string, side: 'asset' | 'liability', currentBalance: number, extra: Partial<NetWorthItem> = {}): NetWorthItem => ({
  id, side, currentBalance, balanceUpdatedAt: '2026-10-05T12:00:00Z', archivedAt: null, ...extra,
})
const pt = (itemId: string, balance: number, recordedAt: string): BalancePoint => ({ itemId, balance, recordedAt })

describe('summarize', () => {
  it('suma activos y resta pasivos; las archivadas no cuentan', () => {
    const s = summarize([item('a', 'asset', 1000), item('b', 'asset', 500), item('c', 'liability', 300), item('x', 'asset', 9999, { archivedAt: '2026-10-01T00:00:00Z' })], [], NOW)
    expect(s).toMatchObject({ assets: 1500, liabilities: 300, netWorth: 1200 })
  })

  it('variación con carry-forward contra el cierre del mes anterior', () => {
    const items = [item('a', 'asset', 1500), item('c', 'liability', 200)]
    const points = [
      pt('a', 800, '2026-08-20T12:00:00Z'),
      pt('a', 1000, '2026-09-15T12:00:00Z'), // último antes del cierre de septiembre
      pt('a', 1500, '2026-10-05T12:00:00Z'),
      pt('c', 300, '2026-07-01T12:00:00Z'), // carry-forward desde julio
    ]
    // Cierre de sept: 1000 − 300 = 700. Hoy: 1500 − 200 = 1300.
    expect(summarize(items, points, NOW).deltaVsPrevMonthEnd).toBe(600)
  })

  it('una fuente agregada este mes no entra en la variación', () => {
    const items = [item('a', 'asset', 1200), item('nueva', 'asset', 5000)]
    const points = [pt('a', 1000, '2026-09-10T12:00:00Z'), pt('nueva', 5000, '2026-10-03T12:00:00Z')]
    const s = summarize(items, points, NOW)
    expect(s.netWorth).toBe(6200)
    expect(s.deltaVsPrevMonthEnd).toBe(200)
  })

  it('sin referencia al cierre del mes anterior → null', () => {
    expect(summarize([item('a', 'asset', 100)], [pt('a', 100, '2026-10-02T12:00:00Z')], NOW).deltaVsPrevMonthEnd).toBeNull()
  })

  it('un saldo registrado el 30 a las 11 p. m. de Guatemala cuenta para ese cierre', () => {
    // 2026-10-01T04:00Z = 30 sept 22:00 en Guatemala.
    const s = summarize([item('a', 'asset', 100)], [pt('a', 50, '2026-10-01T04:00:00Z')], NOW)
    expect(s.deltaVsPrevMonthEnd).toBe(50)
  })

  it('desactualizada: 30 días no, 31 sí', () => {
    const now = '2026-10-31T12:00:00Z'
    expect(daysSince('2026-10-01T12:00:00Z', now)).toBe(30)
    expect(isStale(item('a', 'asset', 1, { balanceUpdatedAt: '2026-10-01T12:00:00Z' }), now)).toBe(false)
    expect(isStale(item('a', 'asset', 1, { balanceUpdatedAt: '2026-09-30T12:00:00Z' }), now)).toBe(true)
    expect(summarize([item('a', 'asset', 1, { balanceUpdatedAt: '2026-09-30T12:00:00Z' })], [], now).staleSourceIds).toEqual(['a'])
    expect(isStale(item('d', 'liability', 1, { balanceUpdatedAt: null }), now)).toBe(false)
  })

  it('saldo cero y pasivos mayores que activos (patrimonio negativo)', () => {
    const s = summarize([item('a', 'asset', 0), item('b', 'asset', 2000), item('p', 'liability', 15000)], [], NOW)
    expect(s.netWorth).toBe(-13000)
    expect(s.assets).toBe(2000)
  })
})

describe('monthlyHistory', () => {
  it('12 meses completos con huecos, sin interpolar', () => {
    const items = [item('a', 'asset', 3000), item('b', 'asset', 100, { archivedAt: '2026-08-15T12:00:00Z' })]
    const points = [
      pt('a', 1000, '2026-03-10T12:00:00Z'),
      pt('b', 500, '2026-06-01T12:00:00Z'),
      pt('a', 2000, '2026-07-20T12:00:00Z'),
      pt('a', 3000, '2026-10-02T12:00:00Z'), // mes en curso: no aparece
    ]
    const h = monthlyHistory(items, points, NOW)
    expect(h[0]).toEqual({ month: '2026-03', netWorth: 1000 })
    expect(h.find((p) => p.month === '2026-06')).toEqual({ month: '2026-06', netWorth: 1500 })
    expect(h.find((p) => p.month === '2026-07')?.netWorth).toBe(2500)
    // b se archivó en agosto: ya no cuenta al cierre de agosto.
    expect(h.find((p) => p.month === '2026-08')?.netWorth).toBe(2000)
    expect(h.at(-1)?.month).toBe('2026-09')
    expect(h.some((p) => p.month === '2026-02')).toBe(false)
    expect(h.some((p) => p.month === '2026-10')).toBe(false)
  })
  it('prevMonthEnd', () => {
    expect(prevMonthEnd('2026-03-15')).toBe('2026-02-28')
    expect(prevMonthEnd('2026-01-01')).toBe('2025-12-31')
  })
})
