import { describe, it, expect } from 'vitest'
import { FEATURE_KEYS, featuresForPlan, hasFeature, householdPlan, isFeatureKey, planHasFeature } from './features'

const NOW = Date.parse('2026-10-11T12:00:00Z')
const future = '2026-10-20T00:00:00Z'
const past = '2026-09-01T00:00:00Z'

describe('planHasFeature', () => {
  it('Gratis no tiene ninguna función Premium', () => {
    for (const k of FEATURE_KEYS) expect(planHasFeature('free', k)).toBe(false)
  })
  it('Premium y Familiar tienen todas', () => {
    for (const k of FEATURE_KEYS) {
      expect(planHasFeature('premium', k)).toBe(true)
      expect(planHasFeature('family', k)).toBe(true)
    }
  })
  it('featuresForPlan devuelve todas las claves', () => {
    expect(Object.keys(featuresForPlan('free')).sort()).toEqual([...FEATURE_KEYS].sort())
  })
  it('isFeatureKey valida claves', () => {
    expect(isFeatureKey('networth.history')).toBe(true)
    expect(isFeatureKey('otra.cosa')).toBe(false)
  })
})

describe('hasFeature (por hogar)', () => {
  const loader = (row: { plan: string | null; trial_ends_at: string | null } | null) => async () => row

  it('hogar con dueño Gratis: rechaza', async () => {
    expect(await hasFeature('h1', 'recurring.reminders', { load: loader({ plan: 'free', trial_ends_at: past }), now: NOW })).toBe(false)
  })
  it('hogar con dueño Premium: permite', async () => {
    expect(await hasFeature('h1', 'recurring.reminders', { load: loader({ plan: 'premium', trial_ends_at: past }), now: NOW })).toBe(true)
  })
  it('la prueba activa cuenta como Premium', async () => {
    expect(await hasFeature('h1', 'networth.history', { load: loader({ plan: 'free', trial_ends_at: future }), now: NOW })).toBe(true)
  })
  it('hogar inexistente o archivado: Gratis', async () => {
    expect(await householdPlan('h1', { load: loader(null), now: NOW })).toBe('free')
    expect(await hasFeature('h1', 'challenges.multiple', { load: loader(null), now: NOW })).toBe(false)
  })
  it('un plan desconocido cuenta como Gratis', async () => {
    expect(await hasFeature('h1', 'challenges.customize', { load: loader({ plan: 'raro', trial_ends_at: null }), now: NOW })).toBe(false)
  })
})
