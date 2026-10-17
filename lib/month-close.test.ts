import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ createClient: () => ({}) }))

import { pasosCierre } from './month-close'
import { lastDayOf } from './cierre-ui'
import { buildScoreInput, type ScoreRaw } from './health-data'
import { calculateScore } from './score-calculator'

const banco = { id: 'b1', label: 'Banrural', sourceType: 'cuenta_bancaria', done: false }

describe('pasosCierre (C4)', () => {
  it('0 de 2 pasos: sin ingresos registrados y sin estado de cuenta', () => {
    const c = pasosCierre('2026-09', { registrados: 0, sinIngresos: false }, [banco])
    expect(c.totalCount).toBe(2)
    expect(c.completedCount).toBe(0)
    expect(c.canClose).toBe(false)
  })

  it('"Ingresos confirmados" solo con ingresos registrados (o "No hubo ingresos")', () => {
    expect(pasosCierre('2026-09', { registrados: 15000, sinIngresos: false }, []).items[0].done).toBe(true)
    expect(pasosCierre('2026-09', { registrados: 0, sinIngresos: true }, []).items[0].done).toBe(true)
    expect(pasosCierre('2026-09', { registrados: 0, sinIngresos: false }, []).items[0].done).toBe(false)
  })

  it('se puede cerrar al completar todos los obligatorios', () => {
    const c = pasosCierre('2026-09', { registrados: 15000, sinIngresos: false }, [{ ...banco, done: true }])
    expect(c.completedCount).toBe(2)
    expect(c.canClose).toBe(true)
  })

  it('sin bancos, el único paso obligatorio es el de ingresos', () => {
    const c = pasosCierre('2026-09', { registrados: 0, sinIngresos: false }, [])
    expect(c.totalCount).toBe(1)
    expect(c.canClose).toBe(false)
  })
})

describe('"No hubo ingresos" y el puntaje', () => {
  const raw: ScoreRaw = {
    month: '2026-09',
    profile: { total_income: 9000, total_fixed_expenses: 3000, total_savings: 0, income_type: 'fixed' },
    categories: [{ id: 'n', name: 'Renta', bucket: 'needs', budgeted_amount: 3000 }],
    subItems: [],
    incomes: [],
    txs: [{ amount: 3000, type: 'expense', category_id: 'n', date: '2026-09-01' }],
    emergencyGoal: null,
    debts: [],
  }

  it('sin confirmar: provisional', () => {
    expect(calculateScore(buildScoreInput(raw)).provisional).toBe(true)
  })

  it('confirmado: ya no es provisional y el ahorro cuenta como 0 %', () => {
    const r = calculateScore(buildScoreInput({ ...raw, sinIngresos: true }))
    expect(r.provisional).toBe(false)
    const ahorro = r.components.find((c) => c.key === 'savings')!
    expect(ahorro.pending).toBeFalsy()
    expect(ahorro.score).toBe(2)
  })

  it('si después registra un ingreso, manda el ingreso', () => {
    const i = buildScoreInput({ ...raw, sinIngresos: true, txs: [...raw.txs, { amount: 9000, type: 'income', category_id: null, date: '2026-09-15' }] })
    expect(i.provisional).toBe(false)
    expect(i.saved).toBe(6000)
  })
})

describe('lastDayOf', () => {
  it('último día del mes', () => {
    expect(lastDayOf('2026-09')).toBe('2026-09-30')
    expect(lastDayOf('2028-02')).toBe('2028-02-29')
  })
})

describe('avisos de cierre', async () => {
  const { debeAvisarCierre, textoCierre } = await import('./cierre-ui')
  it('Inicio avisa del 1 al 5 si el mes anterior sigue abierto', () => {
    expect(debeAvisarCierre('2026-10-01', false)).toBe(true)
    expect(debeAvisarCierre('2026-10-05', false)).toBe(true)
    expect(debeAvisarCierre('2026-10-06', false)).toBe(false)
    expect(debeAvisarCierre('2026-10-03', true)).toBe(false)
  })
  it('texto de la tarjeta Fin de mes', () => {
    expect(textoCierre('septiembre', [{ type: 'income', label: '' }, { type: 'source', label: 'Banrural' }])).toEqual({
      title: 'Cerrar septiembre: faltan 2 pasos',
      body: 'Registra tus ingresos y carga tu estado de cuenta de Banrural para dejar el mes en orden.',
    })
    expect(textoCierre('septiembre', []).title).toBe('Septiembre está listo para cerrar')
  })
})
