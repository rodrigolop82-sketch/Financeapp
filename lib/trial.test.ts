import { describe, it, expect } from 'vitest'
import { freeChangesRows, shouldWarnTrial, trialEndText, trialProgress, trialUsageRows } from './trial'

const NOW = Date.parse('2026-10-06T12:00:00')
const END = '2026-10-09T12:00:00'

describe('trialProgress', () => {
  it('día 11 de 14', () => {
    expect(trialProgress(END, NOW)).toEqual({ daysLeft: 3, daysUsed: 11 })
  })
})

describe('shouldWarnTrial', () => {
  const base = { trialEndsAt: END, trialActive: true, isOwner: true, paidPlan: 'free' }
  it('avisa los últimos 3 días al dueño sin plan pagado', () => {
    expect(shouldWarnTrial(base, NOW)).toBe(true)
    expect(shouldWarnTrial({ ...base, trialEndsAt: '2026-10-15T12:00:00' }, NOW)).toBe(false)
    expect(shouldWarnTrial({ ...base, isOwner: false }, NOW)).toBe(false)
    expect(shouldWarnTrial({ ...base, paidPlan: 'premium' }, NOW)).toBe(false)
    expect(shouldWarnTrial({ ...base, trialActive: false }, NOW)).toBe(false)
  })
})

describe('textos', () => {
  it('fecha de fin', () => {
    expect(trialEndText(END)).toBe('El viernes 9 de octubre')
  })
  it('omite las filas en 0', () => {
    const rows = trialUsageRows({
      trialEndsAt: END, daysUsed: 11, imports: 3, importedRows: 142,
      member: { name: 'Luis', expenses: 31 }, ownedSpendPct: 96, billsOnTime: 0, questions: 22,
    })
    expect(rows.map((r) => r[1])).toEqual([
      'Importaste 3 estados de cuenta', 'Luis registró 31 gastos', 'Le preguntaste a Zafi 22 veces',
    ])
    expect(rows[1][2]).toBe('El 96% del gasto del hogar ya tiene quién lo pagó')
    expect(trialUsageRows({ trialEndsAt: END, daysUsed: 11, imports: 0, importedRows: 0, member: null, ownedSpendPct: null, billsOnTime: 0, questions: 0 })).toEqual([])
  })
  it('qué cambia con Gratis', () => {
    expect(freeChangesRows('Luis')[0][1]).toBe('Luis pasa a solo ver')
    expect(freeChangesRows(null)).toHaveLength(2)
  })
})
