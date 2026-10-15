import { describe, it, expect } from 'vitest'
import { pickFeaturedCard, weekdayOf } from './featured-card'

const snapshot = { weekStart: '2026-10-05', total: 1200, viewed: false, sparse: false }
const challenge = { id: 'c1', title: '7 días seguidos registrando gastos', dayIndex: 3, durationDays: 7, streak: 3 }
const networth = { hasSources: true, netWorth: 184500, delta: 2500 }

describe('pickFeaturedCard', () => {
  it('lunes y martes: el resumen semanal gana', () => {
    expect(pickFeaturedCard({ weekday: 1, snapshot, challenge, networth })?.kind).toBe('snapshot')
    expect(pickFeaturedCard({ weekday: 2, snapshot, challenge, networth })?.kind).toBe('snapshot')
  })
  it('miércoles, ya visto o semana dispersa: cede al reto', () => {
    expect(pickFeaturedCard({ weekday: 3, snapshot, challenge, networth })?.kind).toBe('challenge')
    expect(pickFeaturedCard({ weekday: 1, snapshot: { ...snapshot, viewed: true }, challenge, networth })?.kind).toBe('challenge')
    expect(pickFeaturedCard({ weekday: 1, snapshot: { ...snapshot, sparse: true }, challenge, networth })?.kind).toBe('challenge')
  })
  it('sin reto: patrimonio, o la invitación si no hay fuentes', () => {
    expect(pickFeaturedCard({ weekday: 4, networth })).toEqual({ kind: 'networth', netWorth: 184500, delta: 2500 })
    expect(pickFeaturedCard({ weekday: 4, networth: { hasSources: false, netWorth: 0, delta: null } })).toEqual({ kind: 'networth_invite' })
  })
  it('nada que mostrar → null', () => {
    expect(pickFeaturedCard({ weekday: 1 })).toBeNull()
  })
  it('weekdayOf', () => {
    expect(weekdayOf('2026-10-12')).toBe(1)
    expect(weekdayOf('2026-10-11')).toBe(0)
  })

  it('F3: con activos y deudas, la tarjeta lleva el desglose', () => {
    expect(pickFeaturedCard({ weekday: 4, networth: { ...networth, assets: 200000, liabilities: 15500 } }))
      .toEqual({ kind: 'networth', netWorth: 184500, delta: 2500, assets: 200000, liabilities: 15500 })
  })
})
