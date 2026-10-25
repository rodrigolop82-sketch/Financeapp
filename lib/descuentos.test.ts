import { describe, it, expect } from 'vitest'
import {
  codeMismatch, codePriceHelp, codeProblem, codeStatus, discountLabel, discountedCents, freeCodeHelp, fromRow,
  grantEnd, normalizeCode, parseNewCode, randomCode, CODE_PATTERN, type DiscountCode,
} from './descuentos'

const NOW = Date.parse('2026-10-25T12:00:00Z')

function code(p: Partial<DiscountCode> = {}): DiscountCode {
  return {
    id: 'c1', code: 'AMIGOS50', percentOff: 50, durationMonths: 3, tiers: ['premium', 'family'], cycles: ['monthly', 'annual'],
    maxRedemptions: null, expiresAt: null, active: true, note: null, redemptions: 0, ...p,
  }
}

describe('normalizeCode', () => {
  it('quita espacios y pasa a mayúsculas', () => {
    expect(normalizeCode('  amigos 50 ')).toBe('AMIGOS50')
    expect(normalizeCode(42)).toBe('')
  })
})

describe('codeProblem', () => {
  it('vale si está activo, vigente, con cupo y sin usar', () => {
    expect(codeProblem(code(), { usedByUser: false, now: NOW })).toBeNull()
  })
  it('pausado, vencido, ya usado y agotado', () => {
    expect(codeProblem(code({ active: false }), { usedByUser: false, now: NOW })).toMatch(/no está activo/)
    expect(codeProblem(code({ expiresAt: '2026-10-01T00:00:00Z' }), { usedByUser: false, now: NOW })).toMatch(/venció/)
    expect(codeProblem(code(), { usedByUser: true, now: NOW })).toMatch(/Ya usaste/)
    expect(codeProblem(code({ maxRedemptions: 5, redemptions: 5 }), { usedByUser: false, now: NOW })).toMatch(/todas las veces/)
  })
})

describe('codeMismatch', () => {
  it('revisa el plan y, si no es gratis, el ciclo', () => {
    expect(codeMismatch(code({ tiers: ['premium'] }), 'family', 'monthly')).toBe('Este código es solo para Premium')
    expect(codeMismatch(code({ cycles: ['annual'] }), 'premium', 'monthly')).toBe('Este código es solo para el plan anual')
    expect(codeMismatch(code({ percentOff: 100, cycles: ['annual'] }), 'premium', 'monthly')).toBeNull()
    expect(codeMismatch(code(), 'family', 'annual')).toBeNull()
  })
})

describe('textos', () => {
  it('discountLabel', () => {
    expect(discountLabel({ percentOff: 100, durationMonths: 3 })).toBe('Gratis por 3 meses')
    expect(discountLabel({ percentOff: 100, durationMonths: 1 })).toBe('Gratis por 1 mes')
    expect(discountLabel({ percentOff: 100, durationMonths: null })).toBe('Gratis sin vencimiento')
    expect(discountLabel({ percentOff: 50, durationMonths: 6 })).toBe('50% por 6 meses')
    expect(discountLabel({ percentOff: 20, durationMonths: null })).toBe('20% para siempre')
  })
  it('precio con descuento y ayudas', () => {
    expect(discountedCents(499, 50)).toBe(250)
    expect(discountedCents(499, 100)).toBe(0)
    expect(codePriceHelp({ percentOff: 50, durationMonths: 3 }, 499, 'al mes')).toBe('Se cobra hoy · $ 2.50 al mes con tu código por 3 meses; después $ 4.99 al mes')
    expect(codePriceHelp({ percentOff: 20, durationMonths: null }, 3999, 'al año')).toBe('Se cobra hoy · $ 31.99 al año con tu código')
    expect(freeCodeHelp({ durationMonths: null })).toBe('Gratis sin vencimiento · sin tarjeta')
  })
})

describe('grantEnd', () => {
  it('suma meses de calendario; indefinido es null', () => {
    expect(grantEnd(3, new Date('2026-10-25T12:00:00Z'))).toBe('2027-01-25T12:00:00.000Z')
    expect(grantEnd(1, new Date('2027-01-31T12:00:00Z'))).toBe('2027-02-28T12:00:00.000Z')
    expect(grantEnd(null)).toBeNull()
  })
})

describe('parseNewCode', () => {
  const base = { code: 'fundadores', percentOff: '100', durationMonths: null, tiers: ['premium', 'family'], cycles: [], maxRedemptions: '', expiresAt: '' }

  it('gratis indefinido: sin ciclo elegido aplica a los dos', () => {
    const r = parseNewCode(base, NOW)
    expect(r).toEqual({ ok: true, value: {
      code: 'FUNDADORES', percentOff: 100, durationMonths: null, tiers: ['premium', 'family'], cycles: ['monthly', 'annual'],
      maxRedemptions: null, expiresAt: null, note: null,
    } })
  })

  it('parcial con meses, cupo y fecha', () => {
    const r = parseNewCode({ ...base, percentOff: 30, durationMonths: '6', cycles: ['monthly'], maxRedemptions: '50', expiresAt: '2026-12-31', note: ' Influencer ' }, NOW)
    expect(r.ok && r.value).toMatchObject({ percentOff: 30, durationMonths: 6, cycles: ['monthly'], maxRedemptions: 50, note: 'Influencer' })
    expect(r.ok && r.value.expiresAt).toBe('2027-01-01T05:59:59.000Z')
  })

  it('rechaza lo inválido', () => {
    expect(parseNewCode({ ...base, code: 'a!' }, NOW)).toMatchObject({ ok: false })
    expect(parseNewCode({ ...base, percentOff: 0 }, NOW)).toMatchObject({ ok: false, error: 'El descuento va de 1% a 100%' })
    expect(parseNewCode({ ...base, percentOff: 101 }, NOW)).toMatchObject({ ok: false })
    expect(parseNewCode({ ...base, durationMonths: 0 }, NOW)).toMatchObject({ ok: false })
    expect(parseNewCode({ ...base, tiers: [] }, NOW)).toMatchObject({ ok: false, error: 'Elige al menos un plan' })
    expect(parseNewCode({ ...base, percentOff: 50, cycles: [] }, NOW)).toMatchObject({ ok: false })
    expect(parseNewCode({ ...base, expiresAt: '2026-01-01' }, NOW)).toMatchObject({ ok: false, error: 'La fecha de vencimiento ya pasó' })
  })
})

describe('varios', () => {
  it('fromRow sin listas aplica a todo', () => {
    const c = fromRow({ id: 'x', code: 'X1Y', percent_off: 10, duration_months: null, tiers: null, cycles: ['annual'], max_redemptions: null, expires_at: null, active: true, note: null }, 2)
    expect(c).toMatchObject({ tiers: ['premium', 'family'], cycles: ['annual'], redemptions: 2 })
  })
  it('codeStatus', () => {
    expect(codeStatus(code(), NOW)).toBe('Activo')
    expect(codeStatus(code({ active: false }), NOW)).toBe('Pausado')
    expect(codeStatus(code({ expiresAt: '2026-01-01T00:00:00Z' }), NOW)).toBe('Vencido')
    expect(codeStatus(code({ maxRedemptions: 1, redemptions: 1 }), NOW)).toBe('Agotado')
  })
  it('randomCode es válido', () => {
    expect(CODE_PATTERN.test(randomCode())).toBe(true)
  })
})
