import { describe, expect, it } from 'vitest'
import { deudasActivas, esCategoriaPagoDeuda, esDeudaActiva, filaPagoDeuda, resumenDeudas } from './deudas-data'
import { componentesDebiles } from './capsule-recommendations'
import { calculateScore, type ScoreInput } from './score-calculator'
import { buildScoreInput, type ScoreRaw } from './health-data'

describe('esDeudaActiva', () => {
  it('sin pagar y con saldo', () => {
    expect(esDeudaActiva({ balance: 5000, is_paid: false })).toBe(true)
    expect(esDeudaActiva({ balance: '5000', is_paid: null })).toBe(true)
    expect(esDeudaActiva({ balance: 5000, is_paid: true })).toBe(false)
    expect(esDeudaActiva({ balance: 0, is_paid: false })).toBe(false)
    expect(esDeudaActiva({ balance: null })).toBe(false)
  })
})

describe('resumenDeudas', () => {
  it('suma cuotas y saldos solo de las activas', () => {
    const r = resumenDeudas([
      { balance: 9000, min_payment: 450 },
      { balance: 30000, min_payment: 1100 },
      { balance: 0, min_payment: 300 },
      { balance: 500, min_payment: 50, is_paid: true },
    ])
    expect(r).toEqual({ hayDeudas: true, cantidad: 2, cuotaMensual: 1550, saldoTotal: 39000 })
    expect(resumenDeudas([]).hayDeudas).toBe(false)
    expect(deudasActivas([{ balance: 0 }])).toEqual([])
  })
})

describe('Pago de deudas extra en el plan', () => {
  it('reconoce la categoría', () => {
    expect(esCategoriaPagoDeuda({ name: 'Pago de deudas extra', bucket: 'savings' })).toBe(true)
    expect(esCategoriaPagoDeuda({ name: 'Abono tarjeta', bucket: 'savings' })).toBe(true)
    expect(esCategoriaPagoDeuda({ name: 'Fondo de emergencia', bucket: 'savings' })).toBe(false)
    expect(esCategoriaPagoDeuda({ name: 'Tarjeta', bucket: 'needs' })).toBe(false)
  })
  it('solo se muestra normal si hay deudas', () => {
    expect(filaPagoDeuda(500, 0, true)).toBe('normal')
    expect(filaPagoDeuda(0, 0, false)).toBe('ocultar')
    expect(filaPagoDeuda(500, 0, false)).toBe('aviso')
    expect(filaPagoDeuda(0, 500, false)).toBe('aviso')
  })
})

describe('deudas coherentes: puntaje y lecciones leen las mismas deudas', () => {
  const raw: ScoreRaw = {
    month: '2026-09',
    profile: { total_income: 10000, total_fixed_expenses: 4000, total_savings: 0, income_type: 'fixed' },
    categories: [{ id: 'n', name: 'Renta', bucket: 'needs', budgeted_amount: 4000 }],
    subItems: [],
    incomes: [],
    txs: [{ amount: 10000, type: 'income', category_id: null, date: '2026-09-01' }],
    emergencyGoal: null,
    debts: [],
  }

  it('sin deudas activas: deuda 20/20 y ninguna lección de deudas', () => {
    const input = buildScoreInput({ ...raw, debts: [{ balance: 0, min_payment: 500 }, { balance: 2000, min_payment: 200, is_paid: true }] })
    expect(input.hasDebts).toBe(false)
    expect(input.debtPayments).toBe(0)
    const score = calculateScore(input)
    expect(score.components.find((c) => c.key === 'debt')!.score).toBe(20)
    expect(componentesDebiles(score.components)).not.toContain('debt')
  })

  it('deuda informal sin pago fijo: cuenta como deuda activa, sin sumar cuota', () => {
    const debts = [{ balance: 4500, min_payment: 0, type: 'informal' }]
    expect(resumenDeudas(debts)).toEqual({ hayDeudas: true, cantidad: 1, cuotaMensual: 0, saldoTotal: 4500 })
    const input = buildScoreInput({ ...raw, debts })
    expect(input.hasDebts).toBe(true)
    expect(input.debtPayments).toBe(0)
    const debt = calculateScore(input).components.find((c) => c.key === 'debt')!
    expect(debt.score).toBe(20)
    expect(debt.detail).toBe('Tus deudas no tienen pago fijo: no pesan en tus cuotas del mes')
    expect(debt.action?.href).toBe('/plan?s=deudas')
  })

  it('con deudas activas que pesan: sí recomienda lecciones de deudas', () => {
    const input = buildScoreInput({ ...raw, debts: [{ balance: 40000, min_payment: 3000 }] })
    expect(input.hasDebts).toBe(true)
    expect(componentesDebiles(calculateScore(input).components)).toContain('debt')
  })

  it('una parte pendiente o al máximo nunca es "débil"', () => {
    const base: ScoreInput = {
      income: 10000, saved: 0, debtPayments: 0, emergencyFund: 0, fixedExpenses: 4000,
      spent: 4000, planned: 8000, incomeType: 'fixed', provisional: true,
    }
    const keys = componentesDebiles(calculateScore(base).components)
    expect(keys).not.toContain('savings')
    expect(keys).not.toContain('debt')
  })
})
