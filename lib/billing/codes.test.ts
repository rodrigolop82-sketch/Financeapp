import { describe, it, expect } from 'vitest'
import { FakeDb } from '../test-utils/fake-supabase'
import { checkCode, expireCodeGrants, redeemFreeCode } from './codes'

const NOW = new Date('2026-10-25T12:00:00Z')

function codeRow(p: Record<string, unknown> = {}) {
  return {
    id: 'c1', code: 'FUNDADORES', percent_off: 100, duration_months: null, tiers: ['premium', 'family'], cycles: ['monthly', 'annual'],
    max_redemptions: null, expires_at: null, active: true, note: null, ...p,
  }
}

function seed(codes = [codeRow()], extra: Record<string, Record<string, unknown>[]> = {}) {
  return new FakeDb({
    users: [{ id: 'ana', plan: 'free' }, { id: 'luis', plan: 'free' }, { id: 'eva', plan: 'free' }],
    households: [{ id: 'h1', owner_id: 'ana' }],
    household_members: [
      { household_id: 'h1', user_id: 'ana', role: 'owner', access: 'full' },
      { household_id: 'h1', user_id: 'luis', role: 'member', access: 'view' },
    ],
    discount_codes: codes,
    discount_redemptions: [],
    subscriptions: [],
    ...extra,
  }, { subscriptions: ['provider_subscription_id'] })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAdmin = (db: FakeDb) => db as any

describe('checkCode', () => {
  it('no existe / ya usado / válido sin importar mayúsculas', async () => {
    const db = seed()
    expect(await checkCode(asAdmin(db), 'ana', 'NOPE')).toEqual({ ok: false, error: 'Ese código no existe' })
    expect(await checkCode(asAdmin(db), 'ana', ' fundadores ')).toMatchObject({ ok: true, code: { code: 'FUNDADORES' } })
    db.rows('discount_redemptions').push({ id: 'r1', code_id: 'c1', user_id: 'ana' })
    expect(await checkCode(asAdmin(db), 'ana', 'FUNDADORES')).toEqual({ ok: false, error: 'Ya usaste este código' })
  })
})

describe('redeemFreeCode', () => {
  it('Familiar sin vencimiento: plan del dueño, miembros con acceso completo y suscripción por código', async () => {
    const db = seed()
    const r = await redeemFreeCode(asAdmin(db), { userId: 'ana', code: 'fundadores', tier: 'family', now: NOW })
    expect(r).toEqual({ ok: true, tier: 'family', periodEnd: null })
    expect(db.rows('users').find((u) => u.id === 'ana')?.plan).toBe('family')
    expect(db.rows('household_members').find((m) => m.user_id === 'luis')?.access).toBe('full')
    expect(db.rows('subscriptions')[0]).toMatchObject({
      user_id: 'ana', provider: 'code', tier: 'family', status: 'active', current_period_end: null, discount_code_id: 'c1',
    })
    expect(db.rows('discount_redemptions')).toHaveLength(1)
  })

  it('por N meses vence en N meses', async () => {
    const db = seed([codeRow({ duration_months: 3 })])
    const r = await redeemFreeCode(asAdmin(db), { userId: 'ana', code: 'FUNDADORES', tier: 'premium', now: NOW })
    expect(r).toMatchObject({ ok: true, periodEnd: '2027-01-25T12:00:00.000Z' })
  })

  it('no se canjea dos veces ni con otro plan activo', async () => {
    const db = seed()
    await redeemFreeCode(asAdmin(db), { userId: 'ana', code: 'FUNDADORES', tier: 'premium', now: NOW })
    expect(await redeemFreeCode(asAdmin(db), { userId: 'ana', code: 'FUNDADORES', tier: 'premium', now: NOW }))
      .toMatchObject({ ok: false, error: 'Ya usaste este código' })

    const db2 = seed([codeRow()], { subscriptions: [{ id: 's1', user_id: 'ana', provider: 'recurrente', provider_subscription_id: 'su_1', status: 'active', current_period_end: '2027-01-01T00:00:00Z' }] })
    expect(await redeemFreeCode(asAdmin(db2), { userId: 'ana', code: 'FUNDADORES', tier: 'premium', now: NOW }))
      .toMatchObject({ ok: false, status: 409 })
  })

  it('respeta el plan del código y que sea gratis', async () => {
    expect(await redeemFreeCode(asAdmin(seed([codeRow({ tiers: ['premium'] })])), { userId: 'ana', code: 'FUNDADORES', tier: 'family', now: NOW }))
      .toMatchObject({ ok: false, error: 'Este código es solo para Premium' })
    expect(await redeemFreeCode(asAdmin(seed([codeRow({ percent_off: 50 })])), { userId: 'ana', code: 'FUNDADORES', tier: 'premium', now: NOW }))
      .toMatchObject({ ok: false, error: 'Este código es un descuento: aplícalo al pagar' })
  })

  it('el cupo: el último uso se da una vez y después se agota', async () => {
    const db = seed([codeRow({ max_redemptions: 1 })])
    expect(await redeemFreeCode(asAdmin(db), { userId: 'ana', code: 'FUNDADORES', tier: 'premium', now: NOW })).toMatchObject({ ok: true })
    expect(await redeemFreeCode(asAdmin(db), { userId: 'eva', code: 'FUNDADORES', tier: 'premium', now: NOW }))
      .toMatchObject({ ok: false, error: 'Este código ya se usó todas las veces posibles' })
    expect(db.rows('discount_redemptions')).toHaveLength(1)
  })
})

describe('expireCodeGrants', () => {
  it('vence solo los planes por código con fecha pasada', async () => {
    const db = seed([codeRow()], { subscriptions: [
      { id: 's1', user_id: 'ana', provider: 'code', status: 'active', current_period_end: '2026-10-20T00:00:00Z' },
      { id: 's2', user_id: 'eva', provider: 'code', status: 'active', current_period_end: null },
      { id: 's3', user_id: 'luis', provider: 'code', status: 'active', current_period_end: '2026-12-01T00:00:00Z' },
      { id: 's4', user_id: 'luis', provider: 'recurrente', status: 'active', current_period_end: '2026-10-01T00:00:00Z' },
    ] })
    expect(await expireCodeGrants(asAdmin(db), NOW)).toEqual(['ana'])
    expect(db.rows('subscriptions').map((s) => s.status)).toEqual(['cancelled', 'active', 'active', 'active'])
  })
})
