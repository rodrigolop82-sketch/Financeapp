import { describe, it, expect } from 'vitest'
import { findDuplicates, looksSame, mergeErrorText, monthsSpan, planRows, rowValue, similarGoal } from './unir'

describe('repetidos', () => {
  it('mismo día, monto y comercio; cada uno se usa una vez', () => {
    const host = [
      { id: 'h1', date: '2026-10-01', amount: 512, description: 'Paiz', type: 'expense' },
      { id: 'h2', date: '2026-09-28', amount: 300, description: 'Puma Gas', type: 'expense' },
    ]
    const guest = [
      { id: 'g1', date: '2026-10-01', amount: 512, description: 'PAIZ', type: 'expense' },
      { id: 'g2', date: '2026-10-01', amount: 512, description: 'Paiz', type: 'expense' },
      { id: 'g3', date: '2026-09-28', amount: 301, description: 'Puma Gas', type: 'expense' },
    ]
    expect(findDuplicates(host, guest).map((d) => [d.guestId, d.hostId])).toEqual([['g1', 'h1']])
  })
})

describe('plan del mes combinado', () => {
  const host = [
    { id: 'hv', name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 3500 },
    { id: 'ha', name: 'Alimentación', bucket: 'needs', budgeted_amount: 1500 },
    { id: 'hs', name: 'Servicios (agua, luz, internet)', bucket: 'needs', budgeted_amount: 650 },
    { id: 'hi', name: 'Salario', bucket: 'income', budgeted_amount: 6500 },
  ]
  const guest = [
    { id: 'gv', name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 3500 },
    { id: 'ga', name: 'Alimentacion', bucket: 'needs', budgeted_amount: 900 },
    { id: 'gs', name: 'Servicios (agua, luz, internet)', bucket: 'needs', budgeted_amount: 600 },
    { id: 'gg', name: 'Gimnasio', bucket: 'wants', budgeted_amount: 250 },
  ]
  it('empareja por nombre y marca lo que parece lo mismo', () => {
    const rows = planRows(host, guest)
    const by = Object.fromEntries(rows.map((r) => [r.guestId ?? r.hostId, r]))
    expect(by.gv).toMatchObject({ hostId: 'hv', looksSame: true, pick: 'host' })
    expect(by.ga).toMatchObject({ hostId: 'ha', looksSame: false, pick: 'sum', host: 1500, guest: 900 })
    expect(by.gs.looksSame).toBe(true)
    expect(by.gg).toMatchObject({ hostId: null, guest: 250 })
    expect(rows.some((r) => r.hostId === 'hi')).toBe(false)
    expect(rowValue(by.ga)).toBe(2400)
    expect(rowValue(by.ga, 'guest')).toBe(900)
    expect(rowValue(by.gg)).toBe(250)
  })
  it('looksSame solo en Vivienda y Servicios, ±10%', () => {
    expect(looksSame('Vivienda/alquiler', 3500, 3200)).toBe(true)
    expect(looksSame('Vivienda/alquiler', 3500, 3000)).toBe(false)
    expect(looksSame('Alimentación', 900, 900)).toBe(false)
  })
})

describe('metas y textos', () => {
  it('metas parecidas', () => {
    const host = [{ id: 'h', name: 'Fondo de emergencia', current_amount: 3000, goal_type: 'emergency_fund' }, { id: 'v', name: 'Viaje a Cancún', current_amount: 2800 }]
    expect(similarGoal({ id: 'g', name: 'Emergencias', current_amount: 2200, goal_type: 'emergency_fund' }, host)?.id).toBe('h')
    expect(similarGoal({ id: 'g', name: 'viaje', current_amount: 1 }, host)?.id).toBe('v')
    expect(similarGoal({ id: 'g', name: 'Laptop', current_amount: 1500 }, host)).toBeNull()
  })
  it('meses', () => {
    expect(monthsSpan(['2026-08-03', '2026-09-20'])).toBe('Agosto y septiembre')
    expect(monthsSpan(['2026-03-03', '2026-09-20'])).toBe('De marzo a septiembre')
    expect(monthsSpan(['2026-09-03'])).toBe('Septiembre')
    expect(monthsSpan(['2025-12-03', '2026-01-20'])).toBe('Diciembre 2025 y enero 2026')
  })
  it('errores', () => {
    expect(mergeErrorText('host_not_family', 'Ana')).toBe('Para juntar sus cuentas, Ana necesita el plan Familiar. Le avisamos.')
  })
})
