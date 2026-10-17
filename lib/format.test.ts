import { describe, it, expect } from 'vitest'
import { formatMoney, formatMonthCount, formatNumber, formatPercent, formatTerm } from './format'

describe('formatNumber', () => {
  it('usa coma para miles y punto para decimales (es-GT)', () => {
    expect(formatNumber(3000)).toBe('3,000')
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(4.67, 1)).toBe('4.7')
    expect(formatNumber(8500.75, 2)).toBe('8,500.75')
  })

  it('redondea sin dejar "-0"', () => {
    expect(formatNumber(2.5)).toBe('3')
    expect(formatNumber(-0.2)).toBe('0')
  })
})

describe('formatMoney', () => {
  it('Q con separador de miles', () => {
    expect(formatMoney(3000)).toBe('Q 3,000')
    expect(formatMoney(3000.5, { showDecimals: true })).toBe('Q 3,000.50')
    expect(formatMoney(-250)).toBe('Q -250')
    expect(formatMoney(20, { currency: 'USD' })).toBe('$ 20')
  })

  it('compacto con punto decimal', () => {
    expect(formatMoney(1500, { compact: true })).toBe('Q 1.5k')
    expect(formatMoney(2_300_000, { compact: true })).toBe('Q 2.3M')
    expect(formatMoney(999, { compact: true })).toBe('Q 999')
  })
})

describe('formatMonthCount', () => {
  it('usa el mismo punto decimal que los montos', () => {
    expect(formatMonthCount(4.666)).toBe('4.7 meses')
    expect(formatMonthCount(3)).toBe('3 meses')
    expect(formatMonthCount(1)).toBe('1 mes')
    expect(formatMonthCount(0.96)).toBe('1 mes')
    expect(formatMonthCount(0)).toBe('0 meses')
  })
})

describe('formatTerm', () => {
  it('pasa a años en plazos largos', () => {
    expect(formatTerm(8)).toBe('8 meses')
    expect(formatTerm(1)).toBe('1 mes')
    expect(formatTerm(16)).toBe('1 año 4 m')
    expect(formatTerm(24)).toBe('2 años')
    expect(formatTerm(400)).toBe('+30 años')
  })
})

describe('formatPercent', () => {
  it('un decimal con punto', () => {
    expect(formatPercent(0.125)).toBe('12.5%')
  })
})
