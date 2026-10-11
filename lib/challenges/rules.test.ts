import { describe, it, expect } from 'vitest'
import { challengeTitle, checkStart, parseStartRequest, type TemplateRow } from './rules'

const spend: TemplateRow = { id: 't-spend', slug: 'spend_reduction_30d', type: 'spend_reduction', title: 'Reduce tu gasto en {categoria} por 30 días', duration_days: 30, default_config: { requires_category: true }, active: true }
const streak: TemplateRow = { id: 't-streak', slug: 'logging_streak_7d', type: 'logging_streak', title: '7 días seguidos registrando gastos', duration_days: 7, default_config: {}, active: true }
const cats = new Set(['res', 'ali'])
const free = { multiple: false, customize: false }
const premium = { multiple: true, customize: true }

describe('checkStart (gating en servidor)', () => {
  it('gratis sin reto activo: puede empezar y elegir la categoría requerida', () => {
    expect(checkStart({ template: spend, request: { templateId: 't-spend', categoryId: 'res' }, active: [], validCategoryIds: cats, features: free }))
      .toEqual({ ok: true, categoryId: 'res', targetAmount: null })
  })
  it('gratis con un reto activo: rechaza el segundo', () => {
    const r = checkStart({ template: streak, request: { templateId: 't-streak' }, active: [{ templateId: 't-spend', categoryId: 'res' }], validCategoryIds: cats, features: free })
    expect(r).toMatchObject({ ok: false, status: 403, premium: true })
  })
  it('premium: varios retos a la vez', () => {
    expect(checkStart({ template: streak, request: { templateId: 't-streak' }, active: [{ templateId: 't-spend', categoryId: 'res' }], validCategoryIds: cats, features: premium }).ok).toBe(true)
  })
  it('gratis no puede personalizar la meta; premium sí', () => {
    const req = { templateId: 't-spend', categoryId: 'res', targetAmount: 500 }
    expect(checkStart({ template: spend, request: req, active: [], validCategoryIds: cats, features: free })).toMatchObject({ ok: false, status: 403 })
    expect(checkStart({ template: spend, request: req, active: [], validCategoryIds: cats, features: premium })).toEqual({ ok: true, categoryId: 'res', targetAmount: 500 })
  })
  it('valida categoría requerida, sobrante o ajena', () => {
    expect(checkStart({ template: spend, request: { templateId: 't-spend' }, active: [], validCategoryIds: cats, features: free })).toMatchObject({ status: 400 })
    expect(checkStart({ template: streak, request: { templateId: 't-streak', categoryId: 'res' }, active: [], validCategoryIds: cats, features: free })).toMatchObject({ status: 400 })
    expect(checkStart({ template: spend, request: { templateId: 't-spend', categoryId: 'otra' }, active: [], validCategoryIds: cats, features: free })).toMatchObject({ status: 400 })
  })
  it('no repite el mismo reto activo', () => {
    expect(checkStart({ template: spend, request: { templateId: 't-spend', categoryId: 'res' }, active: [{ templateId: 't-spend', categoryId: 'res' }], validCategoryIds: cats, features: premium })).toMatchObject({ status: 409 })
  })
  it('plantilla inactiva o inexistente', () => {
    expect(checkStart({ template: { ...streak, active: false }, request: { templateId: 't-streak' }, active: [], validCategoryIds: cats, features: free })).toMatchObject({ status: 404 })
    expect(checkStart({ template: null, request: { templateId: 'x' }, active: [], validCategoryIds: cats, features: free })).toMatchObject({ status: 404 })
  })
})

describe('parseStartRequest / challengeTitle', () => {
  it('lee el cuerpo', () => {
    expect(parseStartRequest({ templateId: 't', categoryId: 'res', targetAmount: '300' })).toEqual({ templateId: 't', categoryId: 'res', targetAmount: 300 })
    expect(parseStartRequest({ templateId: 't', targetAmount: -1 })).toBeNull()
    expect(parseStartRequest({})).toBeNull()
  })
  it('pone la categoría en el título', () => {
    expect(challengeTitle('14 días sin {categoria}', 'Restaurantes')).toBe('14 días sin Restaurantes')
  })
})
