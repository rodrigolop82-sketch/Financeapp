import { describe, it, expect } from 'vitest'
import { hiddenHistoryText, meterColor, meterText, premiumGate } from './premium'
import { clampHistoryFrom, freeHistoryStart } from './plans'

describe('premiumGate', () => {
  it('import: título con el mes, renovación el 1 del siguiente y medidor', () => {
    const g = premiumGate('import', { today: '2026-10-06', used: 2, limit: 2 })
    expect(g.title).toBe('Ya usaste tus 2 importaciones de octubre')
    expect(g.subtitle).toBe('Se renuevan el 1 de noviembre.')
    expect(g.meter).toEqual({ used: 2, limit: 2, noun: 'importaciones' })
    expect(g.href).toBe('/planes?from=import')
  })
  it('diciembre se renueva en enero', () => {
    expect(premiumGate('ia', { today: '2026-12-20' }).subtitle).toBe('Se renuevan el 1 de enero.')
  })
  it('familia habla de Familiar con el nombre', () => {
    const g = premiumGate('familia', { today: '2026-10-06', memberName: 'Luis' })
    expect(g.title).toBe('Luis ya puede ver tu plan')
    expect(g.plan).toBe('Con Premium Familiar')
    expect(g.cta).toBe('Ver Familiar')
    expect(g.perks[0]).toBe('Luis también registra sus gastos')
  })
  it('en un hogar de dos los beneficios son de Familiar', () => {
    const g = premiumGate('history', { today: '2026-10-06', family: true })
    expect(g.plan).toBe('Con Premium Familiar')
    expect(g.href).toBe('/planes?tier=family&from=history')
  })
})

describe('medidor', () => {
  it('texto y color', () => {
    expect(meterText('import', 1, 2)).toBe('Te queda 1 importación gratis este mes')
    expect(meterText('ia', 3, 15)).toBe('Te quedan 12 preguntas gratis este mes')
    expect(meterText('ia', 15, 15)).toBe('Ya usaste tus preguntas gratis de este mes')
    expect(meterColor(0, 2)).toBe('#2563EB')
    expect(meterColor(1, 2)).toBe('#F59E0B')
  })
})

describe('historial de Gratis', () => {
  it('empieza el 1 del mes actual menos 2', () => {
    expect(freeHistoryStart('2026-10-06')).toBe('2026-08-01')
    expect(freeHistoryStart('2026-01-31')).toBe('2025-11-01')
  })
  it('recorta el from', () => {
    expect(clampHistoryFrom(null, '2026-08-01')).toBe('2026-08-01')
    expect(clampHistoryFrom('2026-01-01', '2026-08-01')).toBe('2026-08-01')
    expect(clampHistoryFrom('2026-09-01', '2026-08-01')).toBe('2026-09-01')
  })
  it('texto de lo oculto', () => {
    expect(hiddenHistoryText(41, '2026-08-01', '2026-10-06')).toEqual({
      strong: 'Hay 41 resultados más',
      rest: 'antes de agosto. Siguen guardados; con Premium los ves todos.',
    })
    expect(hiddenHistoryText(1, '2025-11-01', '2026-01-06').strong).toBe('Hay 1 resultado más')
    expect(hiddenHistoryText(1, '2025-11-01', '2026-01-06').rest).toContain('noviembre de 2025')
  })
})
