import { describe, it, expect } from 'vitest'
import { canSeeSource, parseBalance, parseNewSource, parseSourceUpdate } from './sources'

describe('parseBalance', () => {
  it('saldo ≥ 0 y numérico', () => {
    expect(parseBalance('184,500.50')).toEqual({ ok: true, value: 184500.5 })
    expect(parseBalance(0)).toEqual({ ok: true, value: 0 })
    expect(parseBalance(-1).ok).toBe(false)
    expect(parseBalance('abc').ok).toBe(false)
  })
})

describe('parseNewSource', () => {
  it('el saldo es opcional; una cuenta bancaria entra al cierre de mes por defecto', () => {
    expect(parseNewSource({ kind: 'bank_account', name: 'Monetaria', institution: ' BI ' })).toEqual({
      ok: true,
      value: { kind: 'bank_account', name: 'Monetaria', institution: 'BI', balance: null, shared: false, tracksStatements: true, last4: null, debtId: null },
    })
    expect(parseNewSource({ kind: 'investment', name: 'Plazo fijo', balance: '5000' })).toMatchObject({ ok: true, value: { balance: 5000, tracksStatements: false } })
  })
  it('las tarjetas no llevan saldo propio; se vinculan a su deuda', () => {
    expect(parseNewSource({ kind: 'credit_card', name: 'Visa', balance: 100 }).ok).toBe(false)
    expect(parseNewSource({ kind: 'credit_card', name: 'Visa', last4: '1234', debtId: 'd1' })).toMatchObject({ ok: true, value: { debtId: 'd1', last4: '1234', balance: null } })
  })
  it('valida nombre, tipo y últimos 4 dígitos', () => {
    expect(parseNewSource({ kind: 'bank_account', name: '  ' }).ok).toBe(false)
    expect(parseNewSource({ kind: 'loan', name: 'x' }).ok).toBe(false)
    expect(parseNewSource({ kind: 'credit_card', name: 'Visa', last4: '12' }).ok).toBe(false)
  })
  it('compartir es explícito', () => {
    expect(parseNewSource({ kind: 'cash', name: 'Caja', shared: true })).toMatchObject({ ok: true, value: { shared: true } })
  })
})

describe('parseSourceUpdate', () => {
  it('actualización parcial', () => {
    expect(parseSourceUpdate({ balance: 50 }, 'bank_account')).toEqual({ ok: true, value: { balance: 50 } })
    expect(parseSourceUpdate({ shared: true, tracksStatements: false }, 'cash')).toEqual({ ok: true, value: { shared: true, tracksStatements: false } })
    expect(parseSourceUpdate({ archive: true }, 'cash')).toEqual({ ok: true, value: { archive: true } })
    expect(parseSourceUpdate({}, 'cash').ok).toBe(false)
  })
  it('tarjeta: sin saldo, con deuda; otras cuentas no se vinculan', () => {
    expect(parseSourceUpdate({ balance: 10 }, 'credit_card').ok).toBe(false)
    expect(parseSourceUpdate({ debtId: null }, 'credit_card')).toEqual({ ok: true, value: { debtId: null } })
    expect(parseSourceUpdate({ debtId: 'd1' }, 'bank_account').ok).toBe(false)
  })
  it('un activo puede cambiar a otro tipo de activo; tarjetas y deudas no', () => {
    expect(parseSourceUpdate({ kind: 'vehicle' }, 'real_estate')).toEqual({ ok: true, value: { kind: 'vehicle' } })
    expect(parseSourceUpdate({ kind: 'real_estate', name: 'Casa' }, 'real_estate')).toEqual({ ok: true, value: { name: 'Casa' } })
    expect(parseSourceUpdate({ kind: 'credit_card' }, 'bank_account').ok).toBe(false)
    expect(parseSourceUpdate({ kind: 'cash' }, 'other_liability').ok).toBe(false)
  })
})

describe('canSeeSource', () => {
  it('propia o compartida', () => {
    expect(canSeeSource({ owner_user_id: 'u1', shared: false }, 'u1')).toBe(true)
    expect(canSeeSource({ owner_user_id: 'u1', shared: false }, 'u2')).toBe(false)
    expect(canSeeSource({ owner_user_id: 'u1', shared: true }, 'u2')).toBe(true)
    expect(canSeeSource({ owner_user_id: null, shared: false }, 'u2')).toBe(true)
  })
})
