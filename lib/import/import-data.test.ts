import { describe, expect, it } from 'vitest'
import type { BankCharge, ExistingTx } from './classify'
import { splitAlreadyImported } from './import-data'

const imported = (id: string, date: string, bankDescription: string, amount: number): ExistingTx => ({
  id, date, amount, description: bankDescription, category_id: null, type: 'expense',
  statement_import_id: 'imp1', bank_description: bankDescription,
})
const charge = (date: string, description: string, amount: number): BankCharge =>
  ({ date, description, amount, type: 'expense' })

describe('splitAlreadyImported (revisión final al guardar)', () => {
  it('descarta lo que ya quedó importado y deja pasar lo nuevo', () => {
    const existing = [imported('a', '2026-10-24', 'LA PISTA', 855)]
    const { keep, skipped } = splitAlreadyImported([
      charge('2026-10-24', 'La Pista', 855),
      charge('2026-10-24', 'ESTACION DE SERVICIO M', 452),
    ], existing)
    expect(skipped.map((c) => c.description)).toEqual(['La Pista'])
    expect(keep.map((c) => c.description)).toEqual(['ESTACION DE SERVICIO M'])
  })

  it('un doble envío no inserta dos veces los mismos cargos', () => {
    const batch = [charge('2026-10-24', 'TEF A : 974774663', 300), charge('2026-10-23', 'CEMACO ZONA 15', 25)]
    const afterFirstSave = [
      imported('x1', '2026-10-24', 'TEF A : 974774663', 300),
      imported('x2', '2026-10-23', 'CEMACO ZONA 15', 25),
    ]
    const { keep, skipped } = splitAlreadyImported(batch, afterFirstSave)
    expect(keep).toEqual([])
    expect(skipped).toHaveLength(2)
  })

  it('dos cargos legítimos iguales y solo uno ya guardado: se guarda el otro', () => {
    const existing = [imported('a', '2026-10-24', 'CEMACO ZONA 15', 25)]
    const { keep, skipped } = splitAlreadyImported([
      charge('2026-10-24', 'CEMACO ZONA 15', 25),
      charge('2026-10-24', 'CEMACO ZONA 15', 25),
    ], existing)
    expect(keep).toHaveLength(1)
    expect(skipped).toHaveLength(1)
  })

  it('sin nada importado, todo se guarda', () => {
    const { keep, skipped } = splitAlreadyImported([charge('2026-10-24', 'UBER', 38)], [])
    expect(keep).toHaveLength(1)
    expect(skipped).toEqual([])
  })
})
