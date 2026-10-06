import { describe, it, expect } from 'vitest'
import { hasSeatFor, memberAccessFor, ownPlan, prorationCreditCents, resolveEffectivePlan } from './plans'

const NOW = Date.parse('2026-10-06T12:00:00Z')
const future = '2026-10-15T00:00:00Z'
const past = '2026-09-01T00:00:00Z'

describe('ownPlan', () => {
  it('la prueba activa da Familiar', () => {
    expect(ownPlan({ plan: 'free', trial_ends_at: future }, NOW)).toBe('family')
    expect(ownPlan({ plan: 'premium', trial_ends_at: future }, NOW)).toBe('family')
  })
  it('sin prueba usa users.plan', () => {
    expect(ownPlan({ plan: 'free', trial_ends_at: past }, NOW)).toBe('free')
    expect(ownPlan({ plan: 'premium', trial_ends_at: past }, NOW)).toBe('premium')
    expect(ownPlan({ plan: 'family', trial_ends_at: null }, NOW)).toBe('family')
    expect(ownPlan({ plan: 'raro', trial_ends_at: null }, NOW)).toBe('free')
  })
})

describe('resolveEffectivePlan', () => {
  const base = { selfId: 'luis', now: NOW }

  it('sin hogar compartido: el propio plan, dueño, acceso completo', () => {
    const r = resolveEffectivePlan({ ...base, self: { plan: 'premium', trial_ends_at: past }, owner: null, membership: null })
    expect(r).toMatchObject({ plan: 'premium', access: 'full', isOwner: true })
  })

  it('miembro de un hogar Familiar: Familiar con su acceso', () => {
    const r = resolveEffectivePlan({
      ...base,
      self: { plan: 'free', trial_ends_at: past },
      owner: { plan: 'family', trial_ends_at: past },
      membership: { householdId: 'h1', ownerId: 'ana', access: 'full' },
    })
    expect(r).toMatchObject({ plan: 'family', access: 'full', isOwner: false, ownerId: 'ana' })
  })

  it('miembro de un hogar en prueba: Familiar, y la prueba es la del dueño', () => {
    const r = resolveEffectivePlan({
      ...base,
      self: { plan: 'free', trial_ends_at: past },
      owner: { plan: 'free', trial_ends_at: future },
      membership: { householdId: 'h1', ownerId: 'ana', access: 'full' },
    })
    expect(r).toMatchObject({ plan: 'family', trialActive: true, trialEndsAt: future })
  })

  it('si el hogar deja de ser Familiar, el miembro pasa a solo ver', () => {
    const r = resolveEffectivePlan({
      ...base,
      self: { plan: 'free', trial_ends_at: past },
      owner: { plan: 'premium', trial_ends_at: past },
      membership: { householdId: 'h1', ownerId: 'ana', access: 'full' },
    })
    expect(r).toMatchObject({ plan: 'free', access: 'view', isOwner: false })
  })

  it('respeta el acceso solo ver guardado aunque el hogar sea Familiar', () => {
    const r = resolveEffectivePlan({
      ...base,
      self: { plan: 'free', trial_ends_at: past },
      owner: { plan: 'family', trial_ends_at: past },
      membership: { householdId: 'h1', ownerId: 'ana', access: 'view' },
    })
    expect(r.access).toBe('view')
  })
})

describe('prorationCreditCents', () => {
  it('devuelve la parte no usada del periodo', () => {
    expect(prorationCreditCents({
      lastAmountCents: 3999, cycle: 'annual',
      periodStart: '2026-01-01T00:00:00Z', periodEnd: '2027-01-01T00:00:00Z',
      now: Date.parse('2026-07-02T12:00:00Z'),
    })).toBe(2000)
  })
  it('sin periodo o ya vencido: 0', () => {
    expect(prorationCreditCents({ lastAmountCents: 499, cycle: 'monthly', periodStart: null, periodEnd: null, now: NOW })).toBe(0)
    expect(prorationCreditCents({ lastAmountCents: 499, cycle: 'monthly', periodStart: null, periodEnd: past, now: NOW })).toBe(0)
  })
  it('sin inicio usa la duración del ciclo y nunca pasa de lo pagado', () => {
    const c = prorationCreditCents({ lastAmountCents: 499, cycle: 'monthly', periodStart: null, periodEnd: '2026-10-21T12:00:00Z', now: NOW })
    expect(c).toBe(250)
    expect(prorationCreditCents({ lastAmountCents: 499, cycle: 'monthly', periodStart: '2026-10-06T12:00:00Z', periodEnd: '2026-11-05T12:00:00Z', now: NOW - 86_400_000 })).toBe(499)
  })
})

describe('asientos', () => {
  it('Familiar da acceso completo; lo demás, solo ver', () => {
    expect(memberAccessFor('family')).toBe('full')
    expect(memberAccessFor('premium')).toBe('view')
    expect(memberAccessFor('free')).toBe('view')
  })
  it('cabe 1 persona además del dueño', () => {
    expect(hasSeatFor(0)).toBe(true)
    expect(hasSeatFor(1)).toBe(false)
  })
})
