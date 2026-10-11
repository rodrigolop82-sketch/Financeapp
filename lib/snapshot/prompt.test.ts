import { describe, it, expect } from 'vitest'
import { buildSnapshotPrompt, numbersIn, snapshotForAi, validateCommentary } from './prompt'
import { computeWeeklySnapshot } from './weekly'

const s = computeWeeklySnapshot({
  weekStart: '2026-10-05',
  categories: [{ id: 'ali', name: 'Alimentación', fixed: false }, { id: 'res', name: 'Restaurantes', fixed: false }],
  budgets: { '2026-10': { ali: 2000, res: 1100 } },
  txs: [
    { date: '2026-10-05', amount: 120, categoryId: 'ali' },
    { date: '2026-10-09', amount: 340, categoryId: 'res' },
    { date: '2026-10-10', amount: 40, categoryId: 'ali' },
  ],
})

describe('buildSnapshotPrompt', () => {
  it('solo manda el JSON agregado (sin ids ni descripciones)', () => {
    const p = buildSnapshotPrompt(s)
    expect(JSON.parse(p.user)).toEqual(snapshotForAi(s))
    expect(p.user).not.toContain('ali')
    expect(p.system).toContain('2 frases')
  })
})

describe('validateCommentary', () => {
  it('acepta cifras que están en la entrada', () => {
    expect(validateCommentary('Gastaste Q 500 y el viernes concentró Q 340. Vas en línea.', s)).toBe('Gastaste Q 500 y el viernes concentró Q 340. Vas en línea.')
  })
  it('descarta cifras inventadas', () => {
    expect(validateCommentary('Podrías ahorrar Q 380 al mes.', s)).toBeNull()
  })
  it('descarta más de 2 frases o texto vacío', () => {
    expect(validateCommentary('Uno. Dos. Tres.', s)).toBeNull()
    expect(validateCommentary('   ', s)).toBeNull()
    expect(validateCommentary(null, s)).toBeNull()
  })
  it('lee cifras con separadores', () => {
    expect(numbersIn('Q 1,234.60 y 34%')).toEqual([1235, 34])
  })
})
