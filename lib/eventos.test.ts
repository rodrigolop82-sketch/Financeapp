import { describe, it, expect } from 'vitest'
import {
  FREE_EVENTOS_ACTIVOS, PLANTILLAS, gastadoPorConcepto, metaParaEvento, montoConcepto, parseNuevoEvento, plantillaDe,
  puedeCrearEvento, resumenEvento, textoCuenta, textoFechas,
} from './eventos'

const TODAY = '2026-10-17'

describe('plantillas', () => {
  it('cumpleaños, graduación, vacación y boda traen conceptos; "En blanco" no', () => {
    expect(PLANTILLAS.map((p) => p.tipo)).toEqual(['cumpleanos', 'graduacion', 'vacacion', 'boda', 'otro'])
    for (const p of PLANTILLAS.slice(0, 4)) expect(p.conceptos.length).toBeGreaterThanOrEqual(8)
    expect(plantillaDe('boda').conceptos).toContain('Luna de miel')
    expect(plantillaDe('vacacion').conceptos).toContain('Hospedaje')
    expect(plantillaDe('otro').conceptos).toEqual([])
    expect(plantillaDe('raro').tipo).toBe('otro')
  })
})

describe('parseNuevoEvento', () => {
  it('limpia nombre y conceptos, ignora conceptos vacíos y acepta montos escritos', () => {
    const r = parseNuevoEvento({
      tipo: 'cumpleanos', nombre: '  Cumple   de Sofía ', fechaInicio: '2026-12-12', fechaFin: null,
      conceptos: [{ nombre: 'Pastel', presupuesto: 'Q 450' }, { nombre: ' ', presupuesto: '10' }, { nombre: 'Piñata', presupuesto: '' }],
    })
    expect(r).toEqual({ ok: true, value: {
      tipo: 'cumpleanos', nombre: 'Cumple de Sofía', fechaInicio: '2026-12-12', fechaFin: null,
      conceptos: [{ nombre: 'Pastel', presupuesto: 450 }, { nombre: 'Piñata', presupuesto: 0 }],
    } })
  })
  it('rechaza tipo, nombre, fechas y montos inválidos', () => {
    expect(parseNuevoEvento({ tipo: 'fiesta', nombre: 'x' }).ok).toBe(false)
    expect(parseNuevoEvento({ tipo: 'boda', nombre: '' }).ok).toBe(false)
    expect(parseNuevoEvento({ tipo: 'boda', nombre: 'B', fechaInicio: '2026-12-10', fechaFin: '2026-12-01' }).ok).toBe(false)
    expect(parseNuevoEvento({ tipo: 'boda', nombre: 'B', fechaInicio: '10/12/2026' }).ok).toBe(false)
    expect(parseNuevoEvento({ tipo: 'boda', nombre: 'B', conceptos: [{ nombre: 'Salón', presupuesto: '-5' }] }).ok).toBe(false)
    expect(montoConcepto('abc')).toBe(0)
    expect(montoConcepto(-5)).toBeNull()
  })
})

describe('resumen y gastado', () => {
  it('suma solo gastos asignados, por concepto', () => {
    const g = gastadoPorConcepto([
      { evento_concepto_id: 'pastel', amount: 300, type: 'expense' },
      { evento_concepto_id: 'pastel', amount: '200.5', type: 'expense' },
      { evento_concepto_id: 'lugar', amount: 1000, type: 'expense' },
      { evento_concepto_id: 'lugar', amount: 999, type: 'income' },
      { evento_concepto_id: null, amount: 50, type: 'expense' },
    ])
    expect(Object.fromEntries(g)).toEqual({ pastel: 500.5, lugar: 1000 })
  })
  it('presupuesto, gastado, restante y conceptos pasados', () => {
    const r = resumenEvento([
      { id: 'a', nombre: 'Pastel', presupuesto: 450, gastado: 500.5 },
      { id: 'b', nombre: 'Lugar', presupuesto: 1500, gastado: 1000 },
      { id: 'c', nombre: 'Extras', presupuesto: 0, gastado: 80 },
    ])
    expect(r).toEqual({ presupuesto: 1950, gastado: 1580.5, restante: 369.5, pct: 81, pasados: 1, sinPresupuesto: 80 })
    expect(resumenEvento([]).pct).toBe(0)
  })
})

describe('límite de Gratis', () => {
  it('un evento activo a la vez; Premium sin límite', () => {
    expect(FREE_EVENTOS_ACTIVOS).toBe(1)
    expect(puedeCrearEvento(false, 0)).toBe(true)
    expect(puedeCrearEvento(false, 1)).toBe(false)
    expect(puedeCrearEvento(true, 7)).toBe(true)
  })
})

describe('fechas', () => {
  it('rango corto y cuenta regresiva', () => {
    expect(textoFechas(null, null, TODAY)).toBe('Sin fecha')
    expect(textoFechas('2026-12-12', null, TODAY)).toBe('12 dic')
    expect(textoFechas('2026-12-12', '2026-12-15', TODAY)).toBe('12–15 dic')
    expect(textoFechas('2026-12-28', '2027-01-03', TODAY)).toBe('28 dic – 3 ene 2027')
    expect(textoCuenta('2026-10-29', null, TODAY)).toBe('Faltan 12 días')
    expect(textoCuenta('2026-10-18', null, TODAY)).toBe('Es mañana')
    expect(textoCuenta('2026-10-17', null, TODAY)).toBe('Es hoy')
    expect(textoCuenta('2026-10-15', '2026-10-20', TODAY)).toBe('En curso')
    expect(textoCuenta('2026-10-01', null, TODAY)).toBe('Ya pasó')
    expect(textoCuenta(null, null, TODAY)).toBeNull()
  })
})

describe('Ahorrar para esto', () => {
  it('reparte el presupuesto entre los meses que faltan', () => {
    expect(metaParaEvento({ tipo: 'vacacion', nombre: 'Semuc', fechaInicio: '2027-04-10' }, 6000, TODAY)).toEqual({
      name: 'Semuc', emoji: '🏖️', goalType: 'travel', targetAmount: 6000, targetDate: '2027-04-10', monthlyContribution: 1000,
    })
    const pronto = metaParaEvento({ tipo: 'otro', nombre: 'Fiesta', fechaInicio: '2026-10-25' }, 900, TODAY)
    expect(pronto).toMatchObject({ emoji: '🎯', goalType: 'custom', monthlyContribution: 900 })
    expect(metaParaEvento({ tipo: 'boda', nombre: 'Boda', fechaInicio: null }, 50000, TODAY).targetDate).toBeNull()
  })
})
