import { describe, expect, it } from 'vitest'
import { chooseKeeper, findDuplicatePairs, mergePatch, originLabel, pairKey, type DupTx } from './find'

const tx = (id: string, date: string, description: string, amount: number, extra: Partial<DupTx> = {}): DupTx => ({
  id, date, description, amount, category_id: null, type: 'expense', created_at: `2026-10-${date.slice(8, 10)}T10:00:00Z`, ...extra,
})
const bank = (id: string, date: string, bankDescription: string, amount: number, extra: Partial<DupTx> = {}): DupTx =>
  tx(id, date, bankDescription, amount, { statement_import_id: 'imp1', bank_description: bankDescription, ...extra })

describe('findDuplicatePairs: confianza y razones', () => {
  it('manual vs banco con nombre parecido, mismo día: muy probable', () => {
    const [p] = findDuplicatePairs([
      tx('m', '2026-10-24', 'Pollo Campero', 269),
      bank('b', '2026-10-24', 'POLLO CAMPERO 118 VTA HERMOSA', 269),
    ])
    expect(p.confidence).toBe('strong')
    expect(p.reasons).toEqual(['Mismo monto', 'Mismo día', 'Nombre parecido'])
    expect(p.keepId).toBe('b')
    expect(p.dropId).toBe('m')
  })

  it('misma categoría a un día aunque el nombre no se parezca: muy probable', () => {
    const [p] = findDuplicatePairs([
      tx('m', '2026-10-23', 'Gasolina', 452, { category_id: 'tra' }),
      bank('b', '2026-10-24', 'ESTACION DE SERVICIO M', 452, { category_id: 'tra' }),
    ])
    expect(p.confidence).toBe('strong')
    expect(p.reasons).toEqual(['Mismo monto', '1 día de diferencia', 'Misma categoría'])
  })

  it('mismo monto a un día sin parecido ni categoría: revisa con cuidado', () => {
    const [p] = findDuplicatePairs([
      tx('m', '2026-10-22', 'Compras de la semana', 214),
      bank('b', '2026-10-23', 'LA TORRE EXPRESS VH1', 214),
    ])
    expect(p.confidence).toBe('weak')
    expect(p.reasons).toEqual(['Mismo monto', '1 día de diferencia'])
  })

  it('a 3 días solo con nombre parecido; sin parecido no es candidata', () => {
    expect(findDuplicatePairs([
      tx('m', '2026-10-21', 'Pollo Campero', 269),
      bank('b', '2026-10-24', 'POLLO CAMPERO 118', 269),
    ])).toHaveLength(1)
    expect(findDuplicatePairs([
      tx('m', '2026-10-21', 'Compras', 269),
      bank('b', '2026-10-24', 'OTRO COMERCIO', 269),
    ])).toHaveLength(0)
    expect(findDuplicatePairs([
      tx('m', '2026-10-20', 'Pollo Campero', 269),
      bank('b', '2026-10-24', 'POLLO CAMPERO 118', 269),
    ])).toHaveLength(0)
  })

  it('dos del banco: solo a un día de diferencia', () => {
    expect(findDuplicatePairs([
      bank('a', '2026-10-24', 'LA PISTA', 855, { statement_import_id: 'imp1' }),
      bank('b', '2026-10-24', 'LA PISTA', 855, { statement_import_id: 'imp2' }),
    ])).toHaveLength(1)
    expect(findDuplicatePairs([
      bank('a', '2026-10-24', 'LA PISTA', 855, { statement_import_id: 'imp1' }),
      bank('b', '2026-10-27', 'LA PISTA', 855, { statement_import_id: 'imp2' }),
    ])).toHaveLength(0)
  })

  it('el monto debe ser exacto y el tipo el mismo', () => {
    expect(findDuplicatePairs([tx('a', '2026-10-24', 'Uber', 38), tx('b', '2026-10-24', 'Uber', 38.5)])).toHaveLength(0)
    expect(findDuplicatePairs([tx('a', '2026-10-24', 'Depósito', 300), tx('b', '2026-10-24', 'Depósito', 300, { type: 'income' })])).toHaveLength(0)
  })
})

describe('findDuplicatePairs: cuándo NO es duplicado', () => {
  it('dos cargos del mismo estado de cuenta son líneas distintas', () => {
    expect(findDuplicatePairs([
      bank('a', '2026-10-24', 'CEMACO ZONA 15', 25),
      bank('b', '2026-10-24', 'CEMACO ZONA 15', 25),
    ])).toHaveLength(0)
  })

  it('hogar de 2: de quién pagó cada uno manda', () => {
    expect(findDuplicatePairs([
      tx('a', '2026-10-24', 'Uber', 38, { paid_by: 'rodrigo' }),
      tx('b', '2026-10-24', 'Uber', 38, { paid_by: 'ileana' }),
    ])).toHaveLength(0)
    expect(findDuplicatePairs([
      tx('a', '2026-10-24', 'Uber', 38, { paid_by: 'rodrigo' }),
      tx('b', '2026-10-24', 'Uber', 38, { paid_by: null }),
    ])).toHaveLength(1)
  })

  it('las parejas descartadas no vuelven a salir', () => {
    const txs = [tx('a', '2026-10-24', 'Uber', 38), tx('b', '2026-10-24', 'Uber', 38)]
    expect(findDuplicatePairs(txs, new Set([pairKey('b', 'a')]))).toHaveLength(0)
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'))
  })
})

describe('findDuplicatePairs: uno a uno', () => {
  it('un movimiento solo aparece en una pareja, la de fecha más cercana', () => {
    const pairs = findDuplicatePairs([
      tx('m', '2026-10-24', 'Uber', 38),
      bank('far', '2026-10-26', 'UBER TRIP', 38, { statement_import_id: 'i1' }),
      bank('near', '2026-10-24', 'UBER TRIP', 38, { statement_import_id: 'i2' }),
    ])
    const ids = pairs.flatMap((p) => [p.a.id, p.b.id])
    expect(new Set(ids).size).toBe(ids.length)
    expect(pairs.some((p) => [p.a.id, p.b.id].includes('m') && [p.a.id, p.b.id].includes('near'))).toBe(true)
  })

  it('lo muy probable sale primero', () => {
    const pairs = findDuplicatePairs([
      tx('w1', '2026-10-25', 'Compras', 214), bank('w2', '2026-10-25', 'OTRO LUGAR', 214),
      tx('s1', '2026-10-20', 'Pollo Campero', 269), bank('s2', '2026-10-20', 'POLLO CAMPERO 118', 269),
    ])
    expect(pairs.map((p) => p.confidence)).toEqual(['strong', 'weak'])
  })
})

describe('chooseKeeper', () => {
  it('uno del banco y otro manual: se queda el del banco', () => {
    const { keep, drop } = chooseKeeper(tx('m', '2026-10-24', 'Uber', 38), bank('b', '2026-10-24', 'UBER', 38))
    expect([keep.id, drop.id]).toEqual(['b', 'm'])
  })
  it('ambos del banco o ambos manuales: el más antiguo', () => {
    const old = bank('old', '2026-10-24', 'UBER', 38, { created_at: '2026-10-25T10:00:00Z' })
    const recent = bank('new', '2026-10-24', 'UBER', 38, { created_at: '2026-11-02T10:00:00Z', statement_import_id: 'imp2' })
    expect(chooseKeeper(recent, old).keep.id).toBe('old')
    const m1 = tx('m1', '2026-10-24', 'Uber', 38, { created_at: '2026-10-24T08:00:00Z' })
    const m2 = tx('m2', '2026-10-24', 'Uber', 38, { created_at: '2026-10-24T09:00:00Z' })
    expect(chooseKeeper(m2, m1).keep.id).toBe('m1')
  })
})

describe('mergePatch: lo que decidió el usuario no se pierde', () => {
  it('al borrar el que anotó a mano, su categoría, parte y nota pasan al del banco', () => {
    const keep = bank('b', '2026-10-24', 'POLLO CAMPERO', 269, { category_id: 'sug' })
    const drop = tx('m', '2026-10-24', 'Pollo Campero', 269, { category_id: 'res', budget_sub_item_id: 'sub1', note: 'cumple de Pauli', scope: 'personal' })
    expect(mergePatch(keep, drop)).toEqual({ category_id: 'res', budget_sub_item_id: 'sub1', note: 'cumple de Pauli', scope: 'personal' })
  })

  it('si la categoría cambia y no hay parte nueva, se quita la parte vieja', () => {
    const keep = bank('b', '2026-10-24', 'X', 10, { category_id: 'sug', budget_sub_item_id: 'old' })
    const drop = tx('m', '2026-10-24', 'X', 10, { category_id: 'res' })
    expect(mergePatch(keep, drop)).toEqual({ category_id: 'res', budget_sub_item_id: null })
  })

  it('no pisa la nota del que se queda y no copia "compartido"', () => {
    const keep = bank('b', '2026-10-24', 'X', 10, { note: 'del banco' })
    const drop = tx('m', '2026-10-24', 'X', 10, { note: 'mía', scope: 'shared' })
    expect(mergePatch(keep, drop)).toEqual({})
  })

  it('entre dos del banco solo se llenan los vacíos', () => {
    const keep = bank('a', '2026-10-24', 'X', 10, { category_id: 'c1' })
    const drop = bank('b', '2026-10-24', 'X', 10, { category_id: 'c2', paid_by: 'ileana', statement_import_id: 'imp2' })
    expect(mergePatch(keep, drop)).toEqual({ paid_by: 'ileana' })
  })
})

describe('originLabel', () => {
  it('etiquetas de origen', () => {
    const m = tx('m', '2026-10-24', 'Uber', 38)
    const b1 = bank('b1', '2026-10-24', 'UBER', 38, { created_at: '2026-10-25T10:00:00Z' })
    const b2 = bank('b2', '2026-10-24', 'UBER', 38, { created_at: '2026-11-02T10:00:00Z', statement_import_id: 'imp2' })
    expect(originLabel(m, b1)).toBe('Lo anotaste tú')
    expect(originLabel(b1, m)).toBe('Estado de cuenta')
    expect(originLabel(b1, b2)).toBe('Estado de cuenta')
    expect(originLabel(b2, b1)).toBe('Importado de nuevo')
  })
})
