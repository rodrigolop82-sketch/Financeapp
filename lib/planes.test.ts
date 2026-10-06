import { describe, it, expect } from 'vitest'
import { defaultTier, longDate, planAction, planBenefits, planFrom, planPrice, planStatusRow } from './planes'

const NOW = new Date('2026-10-06T12:00:00Z')

describe('precios', () => {
  it('muestra monto, periodo y ayuda', () => {
    expect(planPrice('premium', 'annual')).toEqual({ amount: '$ 39.99', period: 'al año', help: '$ 3.33 al mes' })
    expect(planPrice('family', 'annual')).toEqual({ amount: '$ 54.99', period: 'al año', help: '$ 2.29 al mes cada uno' })
    expect(planPrice('premium', 'monthly').help).toBe('Cancela cuando quieras')
    expect(planPrice('family', 'monthly')).toEqual({ amount: '$ 6.99', period: 'al mes', help: '$ 3.50 cada uno' })
  })
})

describe('beneficios', () => {
  it('pone primero el beneficio desde el que llegó', () => {
    expect(planBenefits('premium', 'ia')[0][1]).toBe('Pregúntale a Zafi sin límite')
    expect(planBenefits('premium', null)[0][1]).toBe('Importa sin límite')
    expect(planBenefits('family', 'ia')[0][1]).toBe('2 adultos, cada uno con su cuenta')
    expect(planFrom('history')).toBe('history')
    expect(planFrom('otra')).toBeNull()
  })
})

describe('defaultTier', () => {
  it('Familiar si el hogar es en pareja o ya son dos', () => {
    expect(defaultTier({ householdType: 'family', memberCount: 1 })).toBe('family')
    expect(defaultTier({ householdType: 'individual', memberCount: 2 })).toBe('family')
    expect(defaultTier({ householdType: 'individual', memberCount: 1 })).toBe('premium')
    expect(defaultTier({ memberCount: 1, current: 'family' })).toBe('family')
    expect(defaultTier({ householdType: 'family', memberCount: 2, param: 'premium' })).toBe('premium')
  })
})

describe('planAction', () => {
  const base = { cycle: 'annual' as const, isOwner: true, trialActive: false, trialEndsAt: null, subscription: null, now: NOW }

  it('sin prueba: se cobra hoy', () => {
    expect(planAction({ ...base, tier: 'premium' })).toEqual({ kind: 'checkout', label: 'Activar Premium', help: 'Se cobra hoy · $ 39.99 al año' })
  })
  it('en prueba: el cobro empieza hoy', () => {
    const a = planAction({ ...base, tier: 'family', trialActive: true, trialEndsAt: '2026-10-09T12:00:00Z' })
    expect(a).toMatchObject({ kind: 'checkout', label: 'Activar Familiar' })
    expect(a.kind === 'checkout' && a.help).toContain('Tu prueba sigue hasta el 9 de octubre; el cobro empieza hoy')
  })
  it('miembro: lo paga el dueño, sin precios', () => {
    expect(planAction({ ...base, tier: 'family', isOwner: false, ownerName: 'Ana' })).toEqual({ kind: 'member', text: 'Tu plan lo paga Ana' })
  })
  it('ya paga Premium y elige Familiar: cambio con reembolso', () => {
    const sub = { tier: 'premium' as const, cycle: 'annual' as const, status: 'active', currentPeriodEnd: '2027-01-01T00:00:00Z', cancelAtPeriodEnd: false, creditCents: 1050 }
    expect(planAction({ ...base, tier: 'family', subscription: sub })).toEqual({
      kind: 'change', label: 'Cambiar a Familiar', help: 'Pagas $ 54.99 hoy y te devolvemos $ 10.50 de tu plan actual.',
    })
    expect(planAction({ ...base, tier: 'premium', subscription: sub })).toEqual({ kind: 'current', text: 'Es tu plan · se renueva el 1 de enero de 2027' })
    expect(planAction({ ...base, tier: 'premium', subscription: { ...sub, cancelAtPeriodEnd: true } })).toEqual({ kind: 'current', text: 'Tu plan sigue hasta el 1 de enero de 2027' })
  })
})

describe('planStatusRow', () => {
  const base = { plan: 'free' as const, isOwner: true, trialActive: false, trialEndsAt: null, subscription: null, household: null, now: NOW }
  it('cubre prueba, gratis, premium, familiar y cobro rechazado', () => {
    expect(planStatusRow({ ...base, plan: 'family', trialActive: true, trialEndsAt: '2026-10-09T12:00:00Z' })).toEqual({ title: 'Prueba Premium', hint: 'Quedan 3 días', tone: 'warn' })
    expect(planStatusRow(base)).toEqual({ title: 'Plan Gratis', hint: 'Conoce lo que incluye Premium', tone: 'normal' })
    const sub = { tier: 'premium' as const, cycle: 'annual' as const, status: 'active', currentPeriodEnd: '2027-10-06T12:00:00Z', cancelAtPeriodEnd: false, creditCents: 0 }
    expect(planStatusRow({ ...base, plan: 'premium', subscription: sub }).hint).toBe('Anual · se renueva el 6 de octubre de 2027')
    expect(planStatusRow({
      ...base, plan: 'family', subscription: { ...sub, tier: 'family' },
      household: { name: 'Casa Pérez', members: [{ name: 'Ana' }, { name: 'Luis' }] },
    })).toEqual({ title: 'Familiar · Casa Pérez', hint: 'Anual · Ana y Luis · se renueva el 6 de octubre de 2027', tone: 'normal' })
    expect(planStatusRow({ ...base, plan: 'premium', subscription: { ...sub, status: 'past_due' } }).tone).toBe('danger')
  })
})

describe('longDate', () => {
  it('sin año si es el actual', () => {
    expect(longDate('2026-10-09T12:00:00Z', NOW)).toBe('9 de octubre')
    expect(longDate(null)).toBe('')
  })
})
