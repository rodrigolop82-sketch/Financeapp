import { describe, it, expect } from 'vitest'
import { formatMoney } from '../format'
import { resumenMensualEmail, type ResumenMensualInput } from './plantilla'

const base: ResumenMensualInput = {
  firstName: 'Ana',
  monthName: 'septiembre',
  appUrl: 'https://example.com',
  fmt: (n) => formatMoney(n),
  score: { total: 72, prev: 68 },
  budget: { inLine: 5, total: 7, over: ['Salidas', 'Ropa'] },
  goal: { name: 'Viaje', emoji: '✈️', pct: 40, contributed: 500 },
  step: { title: 'Aporta Q 1,000 a tu fondo de emergencia', effect: 'Sube tu puntaje de 72 a 81' },
}

describe('resumenMensualEmail', () => {
  it('asunto "Así cerró tu {mes}"', () => {
    expect(resumenMensualEmail(base).subject).toBe('Así cerró tu septiembre')
  })

  it('los cuatro bloques, el saludo y el botón Ver mi plan', () => {
    const { html, text } = resumenMensualEmail(base)
    for (const t of ['Salud financiera', 'Tu presupuesto', 'Tu meta principal', 'Tu siguiente paso']) {
      expect(html).toContain(t)
      expect(text).toContain(t)
    }
    expect(html).toContain('Hola, Ana:')
    expect(text).toContain('Subió 4 puntos')
    expect(text).toContain('5 de 7 categorías cerraron en línea. Se pasaron: Salidas, Ropa.')
    expect(html).toContain('Ver mi plan')
    expect(html).toContain('https://example.com/plan/siguiente-paso')
  })

  it('sin siguiente paso se omite ese bloque y el botón', () => {
    const { html, text } = resumenMensualEmail({ ...base, step: null })
    expect(html).not.toContain('Tu siguiente paso')
    expect(html).not.toContain('Ver mi plan')
    expect(text).not.toContain('Ver mi plan')
  })

  it('pie con el enlace a Cuenta › Recordatorios', () => {
    expect(resumenMensualEmail(base).html).toContain('https://example.com/cuenta#recordatorios')
  })

  it('wordmark en minúsculas', () => {
    expect(resumenMensualEmail(base).html).toMatch(/>zafi</)
  })

  it('escapa los textos del usuario', () => {
    const { html } = resumenMensualEmail({ ...base, firstName: '<b>x</b>', goal: { ...base.goal!, name: 'A & B' } })
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('A &amp; B')
  })

  it('puntaje igual o primer mes', () => {
    expect(resumenMensualEmail({ ...base, score: { total: 70, prev: 70 } }).text).toContain('Igual que el mes anterior')
    expect(resumenMensualEmail({ ...base, score: { total: 70, prev: null } }).text).toContain('primer mes')
  })
})
