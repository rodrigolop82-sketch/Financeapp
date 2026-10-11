import { describe, it, expect } from 'vitest'
import { parseOverride, parseReminder } from './actions'

describe('parseOverride', () => {
  it('acepta dismissed, cancelled_by_user y null', () => {
    expect(parseOverride({ merchantKey: 'netflix', status: 'dismissed' }).ok).toBe(true)
    expect(parseOverride({ merchantKey: 'netflix', status: 'cancelled_by_user' }).ok).toBe(true)
    expect(parseOverride({ merchantKey: 'netflix', status: null }).ok).toBe(true)
  })
  it('rechaza estados o claves inválidas', () => {
    expect(parseOverride({ merchantKey: 'netflix', status: 'otro' })).toMatchObject({ ok: false, status: 400 })
    expect(parseOverride({ merchantKey: '', status: 'dismissed' })).toMatchObject({ ok: false, status: 400 })
  })
})

describe('parseReminder (gating Premium)', () => {
  it('gratis → rechazo claro del servidor', () => {
    const r = parseReminder({ merchantKey: 'netflix', daysBefore: 2 }, false)
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
  it('premium → ok', () => {
    expect(parseReminder({ merchantKey: 'netflix', daysBefore: 2 }, true)).toEqual({ ok: true, value: { merchantKey: 'netflix', daysBefore: 2 } })
  })
  it('quitar el recordatorio siempre se permite', () => {
    expect(parseReminder({ merchantKey: 'netflix', daysBefore: null }, false).ok).toBe(true)
  })
  it('solo 1, 2 o 3 días', () => {
    expect(parseReminder({ merchantKey: 'netflix', daysBefore: 5 }, true)).toMatchObject({ ok: false, status: 400 })
  })
})
