import { describe, it, expect } from 'vitest'
import { mapEventType, mapSubscriptionStatus, normalizeRecurrentePayload, pick } from './recurrente'
import { catalogId, fromCatalogId } from './catalog'

describe('mapEventType', () => {
  it('normaliza los eventos unificados y los legacy', () => {
    expect(mapEventType('subscription.create')).toBe('activated')
    expect(mapEventType('intent.succeeded')).toBe('renewed')
    expect(mapEventType('payment_intent.succeeded')).toBe('renewed')
    expect(mapEventType('intent.failed')).toBe('payment_failed')
    expect(mapEventType('subscription.past_due')).toBe('payment_failed')
    expect(mapEventType('subscription.cancel')).toBe('cancelled')
    expect(mapEventType('refund.create')).toBe('refunded')
    expect(mapEventType('checkout.expired')).toBe('ignored')
  })
})

describe('mapSubscriptionStatus', () => {
  it('lleva los estados del proveedor a los nuestros', () => {
    expect(mapSubscriptionStatus('active')).toBe('active')
    expect(mapSubscriptionStatus('unpaid')).toBe('past_due')
    expect(mapSubscriptionStatus('canceled')).toBe('cancelled')
    expect(mapSubscriptionStatus(undefined)).toBe('unknown')
  })
})

describe('normalizeRecurrentePayload', () => {
  it('lee el cobro, el checkout y la metadata de un intent', () => {
    const e = normalizeRecurrentePayload({
      event_type: 'intent.succeeded',
      id: 'in_abc',
      amount_in_cents: 3999,
      checkout: { id: 'ch_1', metadata: { user_id: 'u1', tier: 'premium', cycle: 'annual' } },
      subscription: { id: 'su_1', current_period_end: '2027-10-06T00:00:00Z' },
    }, 'msg_1')
    expect(e).toMatchObject({
      id: 'msg_1', type: 'renewed', paymentId: 'in_abc', checkoutId: 'ch_1', providerSubscriptionId: 'su_1',
      userId: 'u1', tier: 'premium', cycle: 'annual', amountCents: 3999, periodEnd: '2027-10-06T00:00:00.000Z',
    })
  })

  it('en un evento de suscripción el id de arriba es la suscripción (si no es un intent)', () => {
    expect(normalizeRecurrentePayload({ event_type: 'subscription.cancel', id: 'su_9' }, 'm').providerSubscriptionId).toBe('su_9')
    const e = normalizeRecurrentePayload({ event_type: 'subscription.create', id: 'in_z2zh85f7' }, 'm')
    expect(e.providerSubscriptionId).toBeNull()
    expect(e.paymentId).toBe('in_z2zh85f7')
  })

  it('sin metadata, saca plan y ciclo del producto', () => {
    process.env.RECURRENTE_PRODUCT_FAMILY_MONTHLY = 'prod_fam_m'
    const e = normalizeRecurrentePayload({ event_type: 'subscription.create', product: { id: 'prod_fam_m' } }, 'm')
    expect(e).toMatchObject({ tier: 'family', cycle: 'monthly' })
  })
})

describe('catálogo', () => {
  const env = { RECURRENTE_PRODUCT_PREMIUM_ANNUAL: 'price_pa' }
  it('va y vuelve entre plan × ciclo y el id', () => {
    expect(catalogId('premium', 'annual', env)).toBe('price_pa')
    expect(fromCatalogId('price_pa', env)).toEqual({ tier: 'premium', cycle: 'annual' })
    expect(fromCatalogId('otro', env)).toBeNull()
    expect(() => catalogId('family', 'annual', env)).toThrow('RECURRENTE_PRODUCT_FAMILY_ANNUAL')
  })
})

describe('pick', () => {
  it('devuelve el primer valor que exista', () => {
    expect(pick({ a: { b: 1 } }, ['x.y', 'a.b'])).toBe(1)
    expect(pick({ a: '' }, ['a'])).toBeNull()
  })
})
