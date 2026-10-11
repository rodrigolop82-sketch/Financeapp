import { describe, it, expect } from 'vitest'
import { parseBalance, parseNewSource, parseSourceUpdate } from './sources'

describe('validación de fuentes', () => {
  it('saldo ≥ 0 y numérico', () => {
    expect(parseBalance('184,500.50')).toEqual({ ok: true, value: 184500.5 })
    expect(parseBalance(0)).toEqual({ ok: true, value: 0 })
    expect(parseBalance(-1).ok).toBe(false)
    expect(parseBalance('abc').ok).toBe(false)
    expect(parseBalance('').ok).toBe(false)
  })
  it('tarjetas y préstamos se registran en Deudas, no aquí', () => {
    expect(parseNewSource({ kind: 'credit_card', name: 'Visa', balance: 100 }).ok).toBe(false)
    expect(parseNewSource({ kind: 'loan', name: 'Carro', balance: 100 }).ok).toBe(false)
    expect(parseNewSource({ kind: 'other_liability', name: 'Préstamo de mi tío', balance: 100 }).ok).toBe(true)
  })
  it('nombre requerido; institución opcional', () => {
    expect(parseNewSource({ kind: 'bank_account', name: '  ', balance: 1 }).ok).toBe(false)
    expect(parseNewSource({ kind: 'bank_account', name: 'Monetaria', institution: ' BI ', balance: 1 })).toEqual({
      ok: true, value: { kind: 'bank_account', name: 'Monetaria', institution: 'BI', balance: 1 },
    })
  })
  it('actualización parcial', () => {
    expect(parseSourceUpdate({ balance: 50 })).toEqual({ ok: true, value: { balance: 50 } })
    expect(parseSourceUpdate({ archive: true })).toEqual({ ok: true, value: { archive: true } })
    expect(parseSourceUpdate({}).ok).toBe(false)
  })
})
