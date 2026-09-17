import { describe, it, expect } from 'vitest'
import { createCategorySchema, updateCategorySchema, MAX_CUSTOM_CATEGORIES, MIN_VISIBLE_DEFAULTS } from './categories'

describe('createCategorySchema', () => {
  const valid = {
    name: 'Tuk-tuk',
    icon: '🛺',
    color: '#2563EB',
    parent_category_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    pace_mode: 'linear' as const,
    expected_day: null,
    budgeted_amount: 0,
  }

  it('acepta input válido', () => {
    const result = createCategorySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rechaza nombre menor a 2 caracteres', () => {
    const result = createCategorySchema.safeParse({ ...valid, name: 'A' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('2 caracteres')
    }
  })

  it('rechaza nombre mayor a 30 caracteres', () => {
    const result = createCategorySchema.safeParse({ ...valid, name: 'A'.repeat(31) })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('30 caracteres')
    }
  })

  it('acepta nombre de exactamente 2 caracteres', () => {
    const result = createCategorySchema.safeParse({ ...valid, name: 'AB' })
    expect(result.success).toBe(true)
  })

  it('acepta nombre de exactamente 30 caracteres', () => {
    const result = createCategorySchema.safeParse({ ...valid, name: 'A'.repeat(30) })
    expect(result.success).toBe(true)
  })

  it('rechaza emoji vacío', () => {
    const result = createCategorySchema.safeParse({ ...valid, icon: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza color no hex', () => {
    const result = createCategorySchema.safeParse({ ...valid, color: 'red' })
    expect(result.success).toBe(false)
  })

  it('rechaza color hex incompleto', () => {
    const result = createCategorySchema.safeParse({ ...valid, color: '#FFF' })
    expect(result.success).toBe(false)
  })

  it('acepta color hex válido', () => {
    const result = createCategorySchema.safeParse({ ...valid, color: '#ff00AA' })
    expect(result.success).toBe(true)
  })

  it('rechaza parent_category_id no UUID', () => {
    const result = createCategorySchema.safeParse({ ...valid, parent_category_id: 'not-uuid' })
    expect(result.success).toBe(false)
  })

  it('rechaza pace_mode inválido', () => {
    const result = createCategorySchema.safeParse({ ...valid, pace_mode: 'daily' })
    expect(result.success).toBe(false)
  })

  it('acepta pace_mode fixed con expected_day', () => {
    const result = createCategorySchema.safeParse({ ...valid, pace_mode: 'fixed', expected_day: 15 })
    expect(result.success).toBe(true)
  })

  it('rechaza expected_day fuera de rango', () => {
    expect(createCategorySchema.safeParse({ ...valid, expected_day: 0 }).success).toBe(false)
    expect(createCategorySchema.safeParse({ ...valid, expected_day: 32 }).success).toBe(false)
  })

  it('acepta budgeted_amount 0 por defecto', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { budgeted_amount: _unused, ...noAmount } = valid
    const result = createCategorySchema.safeParse(noAmount)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.budgeted_amount).toBe(0)
    }
  })

  it('rechaza budgeted_amount negativo', () => {
    const result = createCategorySchema.safeParse({ ...valid, budgeted_amount: -100 })
    expect(result.success).toBe(false)
  })
})

describe('updateCategorySchema', () => {
  it('acepta actualización parcial solo con nombre', () => {
    const result = updateCategorySchema.safeParse({ name: 'Nuevo nombre' })
    expect(result.success).toBe(true)
  })

  it('acepta objeto vacío', () => {
    const result = updateCategorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rechaza nombre vacío cuando se proporciona', () => {
    const result = updateCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('constantes de negocio', () => {
  it('MAX_CUSTOM_CATEGORIES es 15', () => {
    expect(MAX_CUSTOM_CATEGORIES).toBe(15)
  })

  it('MIN_VISIBLE_DEFAULTS es 3', () => {
    expect(MIN_VISIBLE_DEFAULTS).toBe(3)
  })
})
