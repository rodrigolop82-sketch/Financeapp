import { describe, it, expect } from 'vitest'
import {
  averageCompleteMonthSpending,
  detectRecurringCharges,
  matchCancelInfo,
  nextMonthlyDate,
  normalizeMerchantKey,
  recurringTotals,
  type CancelInfoRow,
  type RecurringTxInput,
} from './detect'

const TODAY = '2026-10-11'
let seq = 0
function tx(date: string, amount: number, description: string, categoryId: string | null = 'c-ent'): RecurringTxInput {
  return { id: `t${++seq}`, date, amount, description, categoryId }
}
const series = (desc: string, dates: string[], amounts: number | number[], cat: string | null = 'c-ent') =>
  dates.map((d, i) => tx(d, Array.isArray(amounts) ? amounts[i] : amounts, desc, cat))

describe('normalizeMerchantKey', () => {
  it('agrupa variantes con referencias numéricas y dominios', () => {
    expect(normalizeMerchantKey('NETFLIX.COM 866-579-7172')).toBe('netflix')
    expect(normalizeMerchantKey('Netflix.com #12345')).toBe('netflix')
    expect(normalizeMerchantKey('POS NETFLIX 0042')).toBe('netflix')
  })
  it('quita acentos, prefijos de procesador y espacios', () => {
    expect(normalizeMerchantKey('  Pago   Gimnasio  Físico  ')).toBe('gimnasio fisico')
    expect(normalizeMerchantKey('PAYPAL *SPOTIFY P3A9F1')).toBe('spotify')
  })
  it('vacío → null', () => {
    expect(normalizeMerchantKey('')).toBeNull()
    expect(normalizeMerchantKey('12345')).toBeNull()
  })
})

describe('detectRecurringCharges', () => {
  it('detecta un cobro mensual estable de 4 meses (Netflix)', () => {
    const r = detectRecurringCharges(series('NETFLIX.COM', ['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15'], 99), { today: TODAY })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ merchantKey: 'netflix', typicalAmount: 99, occurrences: 4, status: 'active', priceChange: null, nextExpectedDate: '2026-10-15' })
  })

  it('no detecta supermercado ni gasolina (montos variables)', () => {
    const txs = [
      ...series('WALMART', ['2026-06-03', '2026-07-03', '2026-08-03', '2026-09-03'], [850, 420, 1200, 610]),
      ...series('SHELL', ['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10'], [300, 180, 450, 250]),
    ]
    expect(detectRecurringCharges(txs, { today: TODAY })).toEqual([])
  })

  it('no detecta un comercio con solo 2 cobros', () => {
    expect(detectRecurringCharges(series('SPOTIFY', ['2026-08-05', '2026-09-05'], 59), { today: TODAY })).toEqual([])
  })

  it('tolera ±3 días de variación entre cobros', () => {
    const r = detectRecurringCharges(series('GIMNASIO', ['2026-06-02', '2026-07-05', '2026-08-01', '2026-09-04'], 250), { today: TODAY })
    expect(r).toHaveLength(1)
  })

  it('detecta alza de precio y reporta priceChange', () => {
    const r = detectRecurringCharges(series('SPOTIFY', ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05'], [49, 49, 49, 59]), { today: TODAY })
    expect(r[0].priceChange).toEqual({ from: 49, to: 59 })
    expect(r[0].lastAmount).toBe(59)
  })

  it('no reporta alza por cambios menores a Q 2', () => {
    const r = detectRecurringCharges(series('CLARO', ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05'], [20, 20, 20, 21.5]), { today: TODAY })
    expect(r[0].priceChange).toBeNull()
  })

  it('marca possibly_cancelled pasados 45 días', () => {
    const r = detectRecurringCharges(series('DISNEY PLUS', ['2026-05-20', '2026-06-20', '2026-07-20', '2026-08-20'], 79), { today: TODAY })
    expect(r[0].status).toBe('possibly_cancelled')
    const recent = detectRecurringCharges(series('DISNEY PLUS', ['2026-06-20', '2026-07-20', '2026-08-20', '2026-09-20'], 79), { today: TODAY })
    expect(recent[0].status).toBe('active')
  })

  it('mes parcial: 2 meses completos + el mes en curso no alcanza; 3 completos + el actual sí', () => {
    const two = series('YOUTUBE', ['2026-08-02', '2026-09-02', '2026-10-02'], 70)
    expect(detectRecurringCharges(two, { today: TODAY })).toEqual([])
    const three = series('YOUTUBE', ['2026-07-02', '2026-08-02', '2026-09-02', '2026-10-02'], 70)
    expect(detectRecurringCharges(three, { today: TODAY })).toHaveLength(1)
  })

  it('fin de mes: cobro del 31 → próxima fecha correcta en febrero', () => {
    const r = detectRecurringCharges(series('ICLOUD', ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31'], 25), { today: '2027-02-10' })
    expect(r[0].nextExpectedDate).toBe('2027-02-28')
    expect(nextMonthlyDate('2028-01-31', 31)).toBe('2028-02-29')
  })

  it('cobros quincenales no se clasifican como mensuales', () => {
    const dates = ['2026-07-01', '2026-07-15', '2026-08-01', '2026-08-15', '2026-09-01', '2026-09-15', '2026-10-01']
    expect(detectRecurringCharges(series('COLEGIO', dates, 400), { today: TODAY })).toEqual([])
  })

  it('excluye categorías de préstamo/renta y transacciones del módulo de deudas', () => {
    const rent = series('RENTA APTO', ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'], 3000, 'c-vivienda')
    expect(detectRecurringCharges(rent, { today: TODAY, excludeCategoryIds: ['c-vivienda'] })).toEqual([])
    const loan = series('BANCO PRESTAMO', ['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10'], 1500, 'c-otro')
    expect(detectRecurringCharges(loan, { today: TODAY, excludeTransactionIds: loan.map((t) => t.id) })).toEqual([])
  })

  it('excluye las claves con override del hogar', () => {
    const r = series('NETFLIX', ['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15'], 99)
    expect(detectRecurringCharges(r, { today: TODAY, excludeKeys: ['netflix'] })).toEqual([])
  })
})

describe('recurringTotals', () => {
  it('suma solo los activos y las alzas recientes', () => {
    const txs = [
      ...series('NETFLIX', ['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15'], 99),
      ...series('SPOTIFY', ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05'], [49, 49, 49, 59]),
      ...series('VIEJO GYM', ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'], 200),
    ]
    const t = recurringTotals(detectRecurringCharges(txs, { today: TODAY }), TODAY)
    expect(t.activeCount).toBe(2)
    expect(t.monthlyTotal).toBe(99 + 49)
    expect(t.annualTotal).toBe((99 + 49) * 12)
    expect(t.priceIncrease).toBe(10)
  })
})

describe('averageCompleteMonthSpending', () => {
  it('promedia los últimos 3 meses completos', () => {
    expect(averageCompleteMonthSpending({ '2026-07': 3000, '2026-08': 6000, '2026-09': 9000, '2026-10': 99999 }, TODAY, '2026-01')).toBe(6000)
  })
  it('el mes del primer movimiento no cuenta (puede estar a medias)', () => {
    expect(averageCompleteMonthSpending({ '2026-09': 5000 }, TODAY, '2026-09')).toBeNull()
    expect(averageCompleteMonthSpending({ '2026-08': 1000, '2026-09': 3000 }, TODAY, '2026-08')).toBe(3000)
  })
  it('sin movimientos → null', () => {
    expect(averageCompleteMonthSpending({}, TODAY, null)).toBeNull()
  })
})

describe('matchCancelInfo', () => {
  const rows: CancelInfoRow[] = [
    { merchant_key: 'netflix', display_name: 'Netflix', match_patterns: ['netflix'], cancel_url: null, cancel_email: null, steps: [], notes: null },
    { merchant_key: 'max', display_name: 'Max', match_patterns: ['hbo max', 'max com'], cancel_url: null, cancel_email: null, steps: [], notes: null },
    { merchant_key: 'apple', display_name: 'Apple', match_patterns: ['apple com', 'icloud'], cancel_url: null, cancel_email: null, steps: [], notes: null },
  ]
  it('por clave exacta o patrón de palabra completa', () => {
    expect(matchCancelInfo('netflix', rows)?.display_name).toBe('Netflix')
    expect(matchCancelInfo('hbo max', rows)?.display_name).toBe('Max')
    expect(matchCancelInfo('apple bill', rows)?.display_name).toBe('Apple')
  })
  it('patrones cortos solo exactos', () => {
    expect(matchCancelInfo('max distelsa', rows)).toBeNull()
  })
  it('sin coincidencia → null', () => {
    expect(matchCancelInfo('gimnasio', rows)).toBeNull()
  })
})
