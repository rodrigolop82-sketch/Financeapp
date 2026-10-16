import { describe, it, expect } from 'vitest'
import { namesMatch, planSubscriptions } from './plan'

const cat = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, bucket: 'wants' as const, budgeted_amount: 0, cap_key: null, parent_category_id: null, ...extra,
})
const sub = (id: string, category_id: string, name: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id, category_id, name, amount, is_fixed: true, ...extra,
})

describe('namesMatch', () => {
  it('mismo servicio con nombres distintos', () => {
    expect(namesMatch('netflix', 'netflix')).toBe(true)
    expect(namesMatch('spotify', 'spotify ab')).toBe(true)
    expect(namesMatch('disney plus', 'disney')).toBe(true)
    expect(namesMatch('hbo', 'hbo max')).toBe(true)
  })
  it('no confunde servicios distintos', () => {
    expect(namesMatch('netflix', 'spotify')).toBe(false)
    expect(namesMatch('max', 'maxi despensa')).toBe(false)
  })
})

describe('planSubscriptions', () => {
  it('cada parte de la categoría de suscripciones es una línea, cruzada con lo detectado', () => {
    const categories = [
      cat('c1', 'Suscripciones'),
      cat('c2', 'Supermercado', { bucket: 'needs', budgeted_amount: 3000 }),
      cat('c3', 'Gimnasio', { budgeted_amount: 350 }),
      cat('c4', 'Streaming viejo', { budgeted_amount: 99, archived_at: '2026-01-01' }),
    ]
    const subs = [
      sub('s1', 'c1', 'Netflix', 120),
      sub('s2', 'c1', 'Spotify', 60),
      sub('s3', 'c1', 'iCloud', 240, { recurrence: 'anual' }),
      sub('s4', 'c2', 'Despensa', 3000),
    ]
    const r = planSubscriptions(categories, subs, [{ merchantKey: 'netflix' }, { merchantKey: 'claro' }])
    expect(r.lines.map((l) => [l.name, l.monthly, l.merchantKey])).toEqual([
      ['Gimnasio', 350, null],
      ['Netflix', 120, 'netflix'],
      ['Spotify', 60, null],
      ['iCloud', 20, null],
    ])
    expect(r.monthlyTotal).toBe(550)
  })

  it('un cobro detectado se asigna a una sola línea', () => {
    const r = planSubscriptions([cat('c1', 'Suscripciones')], [sub('a', 'c1', 'Netflix', 120), sub('b', 'c1', 'Netflix extra', 30)], [{ merchantKey: 'netflix' }])
    expect(r.lines.filter((l) => l.merchantKey).length).toBe(1)
  })
})
