import { describe, it, expect } from 'vitest'
import { detectedSourceAction, detectedSourceName, normalizeBankName } from './sources'

const rows = [
  { id: 'a', kind: 'credit_card', institution: 'Industrial', last4: '4821' },
  { id: 'b', kind: 'bank_account', institution: 'Banrural', last4: null },
]

describe('cuenta detectada al importar', () => {
  it('normaliza el banco', () => {
    expect(normalizeBankName('bi')).toBe('Industrial')
  })
  it('no duplica la misma tarjeta', () => {
    expect(detectedSourceAction(rows, { bank: 'Industrial', last4: '4821', kind: 'credit_card' })).toEqual({ action: 'none' })
  })
  it('otra tarjeta del mismo banco se agrega', () => {
    expect(detectedSourceAction(rows, { bank: 'Industrial', last4: '1111', kind: 'credit_card' })).toEqual({ action: 'insert' })
  })
  it('completa los últimos 4 de una cuenta que no los tenía', () => {
    expect(detectedSourceAction(rows, { bank: 'Banrural', last4: '9999', kind: 'bank_account' })).toEqual({ action: 'fill_last4', id: 'b' })
  })
  it('sin últimos 4: basta el mismo banco y tipo', () => {
    expect(detectedSourceAction(rows, { bank: 'banrural', last4: null, kind: 'bank_account' })).toEqual({ action: 'none' })
    expect(detectedSourceAction(rows, { bank: 'BAM', last4: null, kind: 'credit_card' })).toEqual({ action: 'insert' })
  })
  it('nombre legible', () => {
    expect(detectedSourceName({ bank: 'BAM', last4: '1234', kind: 'credit_card' })).toBe('Tarjeta •••• 1234')
    expect(detectedSourceName({ bank: 'BAM', last4: null, kind: 'bank_account' })).toBe('BAM')
  })
})
