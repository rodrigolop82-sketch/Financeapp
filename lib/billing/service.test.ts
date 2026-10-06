import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeDb } from '../test-utils/fake-supabase'
import type { BillingEvent } from './types'

const provider = { cancel: vi.fn(async () => ({ deferred: false })), refund: vi.fn(async () => {}) }
vi.mock('./index', () => ({ billing: () => provider }))

import { applyBillingEvent, downgradeIfExpired } from './service'

function event(p: Partial<BillingEvent>): BillingEvent {
  return {
    id: 'evt_1', type: 'activated', rawType: 'subscription.create', providerSubscriptionId: 'su_1', checkoutId: null,
    userId: null, tier: null, cycle: null, periodStart: null, periodEnd: null, paymentId: null, amountCents: null, payload: {},
    ...p,
  }
}

function seed() {
  return new FakeDb({
    users: [{ id: 'ana', plan: 'free' }, { id: 'luis', plan: 'free' }],
    households: [{ id: 'h1', owner_id: 'ana' }],
    household_members: [
      { household_id: 'h1', user_id: 'ana', role: 'owner', access: 'full' },
      { household_id: 'h1', user_id: 'luis', role: 'member', access: 'view' },
    ],
    billing_checkouts: [{ id: 'ch_1', user_id: 'ana', tier: 'family', cycle: 'annual', replaces_subscription_id: null, credit_cents: 0, completed_at: null }],
    subscriptions: [],
    billing_events: [],
  }, { billing_events: ['id'], subscriptions: ['provider_subscription_id'] })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAdmin = (db: FakeDb) => db as any

beforeEach(() => { provider.cancel.mockClear(); provider.refund.mockClear() })

describe('applyBillingEvent', () => {
  it('activa Familiar desde el checkout: plan del dueño y miembros con acceso completo', async () => {
    const db = seed()
    const r = await applyBillingEvent(asAdmin(db), event({ checkoutId: 'ch_1', periodEnd: '2027-10-06T00:00:00.000Z', paymentId: 'in_1', amountCents: 5499 }))
    expect(r).toBe('applied')
    expect(db.rows('users').find((u) => u.id === 'ana')?.plan).toBe('family')
    expect(db.rows('household_members').find((m) => m.user_id === 'luis')?.access).toBe('full')
    expect(db.rows('subscriptions')[0]).toMatchObject({ user_id: 'ana', tier: 'family', cycle: 'annual', status: 'active', last_payment_id: 'in_1', last_amount_cents: 5499 })
  })

  it('un webhook repetido no se procesa dos veces', async () => {
    const db = seed()
    await applyBillingEvent(asAdmin(db), event({ checkoutId: 'ch_1' }))
    expect(await applyBillingEvent(asAdmin(db), event({ checkoutId: 'ch_1' }))).toBe('duplicate')
    expect(db.rows('subscriptions')).toHaveLength(1)
  })

  it('rechazo → past_due sin quitar el plan', async () => {
    const db = seed()
    await applyBillingEvent(asAdmin(db), event({ checkoutId: 'ch_1' }))
    await applyBillingEvent(asAdmin(db), event({ id: 'evt_2', type: 'payment_failed', rawType: 'intent.failed' }))
    expect(db.rows('subscriptions')[0].status).toBe('past_due')
    expect(db.rows('users').find((u) => u.id === 'ana')?.plan).toBe('family')
    // Recuperación: un cobro bueno lo limpia.
    await applyBillingEvent(asAdmin(db), event({ id: 'evt_3', type: 'renewed', rawType: 'intent.succeeded' }))
    expect(db.rows('subscriptions')[0].status).toBe('active')
  })

  it('cancelación con periodo pagado por delante: sigue hasta el fin; vencida, baja a Gratis y el miembro a solo ver', async () => {
    const db = seed()
    await applyBillingEvent(asAdmin(db), event({ checkoutId: 'ch_1', periodEnd: '2999-01-01T00:00:00.000Z' }))
    await applyBillingEvent(asAdmin(db), event({ id: 'evt_2', type: 'cancelled', rawType: 'subscription.cancel' }))
    expect(db.rows('users').find((u) => u.id === 'ana')?.plan).toBe('family')

    db.rows('subscriptions')[0].current_period_end = '2000-01-01T00:00:00.000Z'
    expect(await downgradeIfExpired(asAdmin(db), 'ana')).toBe(true)
    expect(db.rows('users').find((u) => u.id === 'ana')?.plan).toBe('free')
    expect(db.rows('household_members').find((m) => m.user_id === 'luis')?.access).toBe('view')
  })

  it('Premium → Familiar: al activarse el nuevo cancela el viejo y reembolsa el crédito una sola vez', async () => {
    const db = seed()
    db.rows('subscriptions').push({ id: 's_old', user_id: 'ana', provider_subscription_id: 'su_old', tier: 'premium', cycle: 'annual', status: 'active', last_payment_id: 'in_old', last_amount_cents: 3999, current_period_end: '2027-01-01T00:00:00Z' })
    db.rows('billing_checkouts').push({ id: 'ch_2', user_id: 'ana', tier: 'family', cycle: 'annual', replaces_subscription_id: 'su_old', credit_cents: 2000, completed_at: null })

    await applyBillingEvent(asAdmin(db), event({ id: 'evt_a', checkoutId: 'ch_2', providerSubscriptionId: 'su_new' }))
    await applyBillingEvent(asAdmin(db), event({ id: 'evt_b', type: 'renewed', rawType: 'intent.succeeded', checkoutId: 'ch_2', providerSubscriptionId: 'su_new' }))

    expect(provider.cancel).toHaveBeenCalledTimes(1)
    expect(provider.cancel).toHaveBeenCalledWith('su_old', { atPeriodEnd: false })
    expect(provider.refund).toHaveBeenCalledTimes(1)
    expect(provider.refund).toHaveBeenCalledWith('in_old', 2000)
    expect(db.rows('subscriptions').find((s) => s.provider_subscription_id === 'su_old')?.status).toBe('cancelled')
    expect(db.rows('users').find((u) => u.id === 'ana')?.plan).toBe('family')
  })

  it('si falla, borra la marca para que el proveedor reintente', async () => {
    const db = seed()
    provider.cancel.mockRejectedValueOnce(new Error('caído'))
    db.rows('billing_checkouts').push({ id: 'ch_3', user_id: 'ana', tier: 'family', cycle: 'monthly', replaces_subscription_id: 'su_x', credit_cents: 100, completed_at: null })
    await expect(applyBillingEvent(asAdmin(db), event({ id: 'evt_f', checkoutId: 'ch_3', providerSubscriptionId: 'su_y' }))).rejects.toThrow('caído')
    expect(db.rows('billing_events')).toHaveLength(0)
  })

  it('sin usuario que lo reclame: unmatched', async () => {
    const db = seed()
    expect(await applyBillingEvent(asAdmin(db), event({ providerSubscriptionId: 'su_desconocida' }))).toBe('unmatched')
  })
})
