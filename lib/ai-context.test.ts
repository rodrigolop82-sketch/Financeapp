import { describe, it, expect } from 'vitest'
import { netWorthSummary, recordedMonths } from './ai-context'
import type { NetWorthData, SourceView } from './networth/data'

const money = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`

const view = (v: Partial<SourceView>): SourceView => ({
  id: 'x', kind: 'bank_account', side: 'asset', name: 'Cuenta', institution: null, balance: 0, daysSinceUpdate: 0, stale: false,
  fromDebts: false, mine: true, shared: false, tracksStatements: false, last4: null, detected: false, debt: null, debtTerms: null, ...v,
})

describe('netWorthSummary', () => {
  it('agrupa activos y deudas como en Mi patrimonio', () => {
    const data: NetWorthData = {
      summary: { assets: 907500, liabilities: 104300, netWorth: 803200, deltaVsPrevMonthEnd: 8320, staleSourceIds: [] },
      assets: [
        view({ name: 'Casa', kind: 'real_estate', balance: 700000 }),
        view({ name: 'Monetaria', institution: 'BI', balance: 42500, daysSinceUpdate: 3 }),
        view({ name: 'CR-V', kind: 'vehicle', balance: 165000 }),
        view({ name: 'Ahorro BAM', balance: null, daysSinceUpdate: null }),
      ],
      liabilities: [
        view({ name: 'Visa', kind: 'credit_card', side: 'liability', balance: 12300, fromDebts: true,
          debtTerms: { debtType: 'credit', purpose: null, interestRate: 36, monthlyPayment: 1200, dueDay: 15, originalAmount: null, monthsLeft: 13 } }),
        view({ name: 'Crédito CR-V', kind: 'loan', side: 'liability', balance: 92000, fromDebts: true,
          debtTerms: { debtType: 'loan', purpose: 'vehicle', interestRate: 14, monthlyPayment: 3450, dueDay: 5, originalAmount: 190000, monthsLeft: 31 } }),
      ],
      accounts: [], debts: [], hasSources: true,
    }
    const text = netWorthSummary(data, money)
    expect(text).toContain('Patrimonio neto: Q 803,200')
    expect(text).toContain('+Q 8,320')
    expect(text.indexOf('Efectivo y equivalentes: Q 42,500')).toBeLessThan(text.indexOf('Vehículos: Q 165,000'))
    expect(text.indexOf('Vehículos')).toBeLessThan(text.indexOf('Inmuebles: Q 700,000'))
    expect(text).toContain('Monetaria (BI): Q 42,500 (actualizado hace 3 días)')
    expect(text).toContain('Cuentas sin saldo registrado (no cuentan): Ahorro BAM')
    expect(text).toContain('Corto plazo: Q 12,300 (pagos Q 1,200/mes)')
    expect(text).toContain('Crédito CR-V: Q 92,000 · préstamo de vehículo · 14% anual · pago Q 3,450/mes · deuda original Q 190,000 · la termina en 2 años 7 m')
  })

  it('sin cuentas lo dice', () => {
    const data = { summary: { assets: 0, liabilities: 0, netWorth: 0, deltaVsPrevMonthEnd: null, staleSourceIds: [] }, assets: [], liabilities: [], accounts: [], debts: [], hasSources: false }
    expect(netWorthSummary(data, money)).toMatch(/aún no registra/)
  })
})

describe('recordedMonths', () => {
  it('totales por mes completo, sin el mes en curso', () => {
    const txs = [
      { amount: 1000, type: 'income' as const, category_id: null, date: '2026-09-01' },
      { amount: 300, type: 'expense' as const, category_id: null, date: '2026-09-10' },
      { amount: 999, type: 'expense' as const, category_id: null, date: '2026-10-02' },
    ]
    expect(recordedMonths(txs, '2026-10', money)).toBe('  2026-09: ingresos Q 1,000 · gastos Q 300 · ahorro Q 700')
  })

  it('lo que va a ahorro no es gasto y sin ingresos no hay ahorro', () => {
    const txs = [
      { amount: 300, type: 'expense' as const, category_id: 'a', date: '2026-09-10' },
      { amount: 200, type: 'expense' as const, category_id: null, date: '2026-09-11' },
    ]
    expect(recordedMonths(txs, '2026-10', money, [{ id: 'a', bucket: 'savings' }]))
      .toBe('  2026-09: ingresos Q 0 · gastos Q 200 · ahorro sin calcular (sin ingresos)')
  })
})
