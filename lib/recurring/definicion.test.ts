import { describe, expect, it } from 'vitest'
import { clasificarRecurrentes, tipoDeMovimiento, tiposPorMovimiento, type CobroBase } from './definicion'
import { planSubscriptions, subscriptionCategoryIds } from './plan'
import type { PlanCategory } from '../plan-del-mes'

const categories: (PlanCategory & { name: string })[] = [
  { id: 'sus', name: 'Suscripciones', bucket: 'wants', budgeted_amount: 250 },
  { id: 'srv', name: 'Servicios (agua, luz, internet)', bucket: 'needs', budgeted_amount: 900 },
  { id: 'edu', name: 'Educación', bucket: 'needs', budgeted_amount: 1100 },
]
const cobro = (merchantKey: string, categoryId: string | null, typicalAmount: number, extra: Partial<CobroBase> = {}): CobroBase =>
  ({ merchantKey, categoryId, typicalAmount, status: 'active', transactionIds: [], ...extra })

describe('una sola definición de suscripción', () => {
  // Caso del usuario de pruebas: el plan dice Q 250 de Suscripciones y Zafi
  // detecta el combo de streaming (Q 250), luz/agua (Q 880) y colegiatura (Q 1,100).
  const charges = [
    cobro('netflix spotify disney', 'sus', 250, { transactionIds: ['t1', 't2'] }),
    cobro('eegsa agua claro', 'srv', 880, { transactionIds: ['t3'] }),
    cobro('colegiatura', 'edu', 1100),
  ]
  const plan = planSubscriptions(categories, [], charges)
  const subCats = subscriptionCategoryIds(categories)
  const r = clasificarRecurrentes(plan, charges, subCats)

  it('el total de suscripciones coincide con el plan (no Q 2,230)', () => {
    expect(subCats).toEqual(['sus'])
    expect(r.suscripciones.mensual).toBe(250)
  })

  it('los demás cobros repetidos son pagos fijos, con su propio total', () => {
    expect(r.pagosFijos.mensual).toBe(1980)
    expect(r.pagosFijos.cantidad).toBe(2)
    expect(r.tipos).toEqual({ 'netflix spotify disney': 'suscripcion', 'eegsa agua claro': 'pago_fijo', colegiatura: 'pago_fijo' })
  })

  it('si se cobra más de lo planeado, cuenta lo cobrado', () => {
    const more = clasificarRecurrentes(plan, [cobro('netflix spotify disney', 'sus', 320)], subCats)
    expect(more.suscripciones.mensual).toBe(320)
  })

  it('una línea del plan con su cobro cuenta lo mayor, sin sumar dos veces', () => {
    const subs = [
      { id: 'p1', category_id: 'sus', name: 'Netflix', amount: 100, is_fixed: true },
      { id: 'p2', category_id: 'sus', name: 'Gimnasio', amount: 300, is_fixed: true },
    ]
    const ch = [cobro('netflix', 'srv', 120), cobro('hbo max', 'sus', 80)]
    const p = planSubscriptions(categories, subs, ch)
    const x = clasificarRecurrentes(p, ch, subscriptionCategoryIds(categories))
    // Netflix: max(100, 120) = 120 (se reconoce por nombre aunque esté en otra categoría).
    // Gimnasio sin cobro (300) vs. HBO sin línea (80): 300.
    expect(x.tipos.netflix).toBe('suscripcion')
    expect(x.suscripciones.mensual).toBe(420)
    expect(x.suscripciones.cantidad).toBe(3)
  })

  it('una posiblemente cancelada no suma', () => {
    const x = clasificarRecurrentes(plan, [cobro('eegsa agua claro', 'srv', 880, { status: 'possibly_cancelled' })], subCats)
    expect(x.pagosFijos.mensual).toBe(0)
  })

  it('etiqueta de cada movimiento en Movimientos', () => {
    const byTx = tiposPorMovimiento(charges, r.tipos)
    const subSet = new Set(subCats)
    expect(tipoDeMovimiento({ id: 't1', category_id: 'sus', type: 'expense' }, byTx, subSet)).toBe('suscripcion')
    expect(tipoDeMovimiento({ id: 't3', category_id: 'srv', type: 'expense' }, byTx, subSet)).toBe('pago_fijo')
    // Aún sin 3 meses de cobros: por su categoría.
    expect(tipoDeMovimiento({ id: 'nuevo', category_id: 'sus', type: 'expense' }, byTx, subSet)).toBe('suscripcion')
    expect(tipoDeMovimiento({ id: 'x', category_id: 'srv', type: 'expense' }, byTx, subSet)).toBeNull()
    expect(tipoDeMovimiento({ id: 't1', category_id: 'sus', type: 'income' }, byTx, subSet)).toBeNull()
  })
})
