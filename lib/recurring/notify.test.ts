import { describe, it, expect } from 'vitest'
import { recurringNotices } from './notify'
import type { RecurringCharge } from './detect'

const fmt = (n: number) => `Q ${n}`
const base: RecurringCharge & { remindDaysBefore: 1 | 2 | 3 | null } = {
  merchantKey: 'netflix', displayName: 'Netflix', categoryId: null, typicalAmount: 99, lastAmount: 99,
  lastDate: '2026-09-15', nextExpectedDate: '2026-10-15', occurrences: 4, status: 'active', priceChange: null,
  history: [], remindDaysBefore: 2,
}
const all = { reminders: true, priceAlerts: true }

describe('recurringNotices', () => {
  it('recordatorio exactamente N días antes, con clave por fecha de cobro', () => {
    const r = recurringNotices('h1', [base], '2026-10-13', fmt, all)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'recurring_reminder', key: 'recurring:h1:netflix:2026-10-15', body: 'Netflix se cobra en 2 días: Q 99' })
    expect(recurringNotices('h1', [base], '2026-10-12', fmt, all)).toEqual([])
  })
  it('sin la función Premium no hay recordatorio', () => {
    expect(recurringNotices('h1', [base], '2026-10-13', fmt, { reminders: false, priceAlerts: true })).toEqual([])
  })
  it('alerta de alza solo si es reciente y es un alza', () => {
    const up = { ...base, remindDaysBefore: null, lastDate: '2026-10-08', priceChange: { from: 89, to: 99 } }
    const r = recurringNotices('h1', [up], '2026-10-11', fmt, all)
    expect(r).toEqual([expect.objectContaining({ kind: 'price_alert', key: 'price:h1:netflix:2026-10-08', body: 'El cobro de Netflix subió de Q 89 a Q 99' })])
    expect(recurringNotices('h1', [up], '2026-10-30', fmt, all)).toEqual([])
    expect(recurringNotices('h1', [{ ...up, priceChange: { from: 99, to: 89 } }], '2026-10-11', fmt, all)).toEqual([])
    expect(recurringNotices('h1', [up], '2026-10-11', fmt, { reminders: true, priceAlerts: false })).toEqual([])
  })
  it('las posiblemente canceladas no avisan', () => {
    expect(recurringNotices('h1', [{ ...base, status: 'possibly_cancelled' }], '2026-10-13', fmt, all)).toEqual([])
  })
})
