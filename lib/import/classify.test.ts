import { describe, expect, it } from 'vitest'
import {
  classifyCharges, cleanBankName, couldBeSamePayment, suggestCategory,
  type BankCharge, type ClassifyContext, type ExistingTx,
} from './classify'

const ctx: ClassifyContext = {
  categories: [
    { id: 'viv', name: 'Vivienda', bucket: 'needs' },
    { id: 'sup', name: 'Súper', bucket: 'needs' },
    { id: 'sus', name: 'Suscripciones', bucket: 'wants' },
    { id: 'ser', name: 'Servicios', bucket: 'needs' },
  ],
  subItems: [
    { id: 'renta', category_id: 'viv', name: 'Renta o hipoteca' },
    { id: 'mant', category_id: 'viv', name: 'Cuota de mantenimiento' },
  ],
  overrides: [],
  fixedLeafIds: ['renta', 'mant', 'ser', 'sus'],
  pendingByLeaf: { renta: 0, mant: 200, ser: 145, sus: 136 },
  currentMonth: '2026-10',
}

const tx = (id: string, date: string, description: string, amount: number, category_id: string | null, extra: Partial<ExistingTx> = {}): ExistingTx =>
  ({ id, date, description, amount, category_id, type: 'expense', statement_import_id: null, ...extra })

// Escenario de los criterios de aceptación de la Fase 7.
const existing: ExistingTx[] = [
  tx('t-super', '2026-10-03', 'Super La Torre', 342.5, 'sup'),
  tx('t-netflix', '2026-10-02', 'Netflix', 89, 'sus'),
  tx('t-renta', '2026-10-01', 'Alquiler', 2500, 'viv', { budget_sub_item_id: 'renta' }),
]
const charge = (date: string, description: string, amount: number, category_id: string | null = null): BankCharge =>
  ({ date, description, amount, type: 'expense', category_id })
const statement: BankCharge[] = [
  charge('2026-10-03', 'SUPERMERCADOS LA TORRE Z10', 342.5),
  charge('2026-10-02', 'NETFLIX.COM', 89),
  charge('2026-10-03', 'COND LAS LUCES CUOTA OCT', 200),
  charge('2026-10-01', 'PRICESMART', 612.4),
  charge('2026-10-02', 'SPOTIFY', 59),
]

describe('classifyCharges: los 4 casos', () => {
  it('2 duplicados, 1 fijo y 2 nuevos', () => {
    const r = classifyCharges(statement, existing, ctx)
    expect(r.map((x) => x.kind)).toEqual(['duplicate', 'duplicate', 'fixed', 'new', 'new'])
    expect(r[0].matchId).toBe('t-super')
    expect(r[1].matchId).toBe('t-netflix')
    expect(r[2]).toMatchObject({ categoryId: 'viv', subItemId: 'mant' })
    expect(r[3].categoryId).toBe('sup')
    expect(r[4].categoryId).toBe('sus')
  })

  it('ya importado: mismo bank_description + fecha + monto con statement_import_id', () => {
    const imported = [
      tx('i1', '2026-10-01', 'Pricesmart', 612.4, 'sup', { statement_import_id: 'imp1', bank_description: 'PRICESMART' }),
      tx('t-super', '2026-10-03', 'Super La Torre', 342.5, 'sup', { statement_import_id: 'imp1', bank_description: 'SUPERMERCADOS LA TORRE Z10' }),
    ]
    const r = classifyCharges(statement, imported, ctx)
    expect(r[3]).toMatchObject({ kind: 'imported', matchId: 'i1' })
    expect(r[0]).toMatchObject({ kind: 'imported', matchId: 't-super' })
  })

  it('un fijo ya pagado no coincide; un monto lejano tampoco', () => {
    const r = classifyCharges([charge('2026-10-03', 'COND LAS LUCES CUOTA OCT', 200)], existing, { ...ctx, pendingByLeaf: { mant: 0 } })
    expect(r[0].kind).toBe('new')
    const far = classifyCharges([charge('2026-10-03', 'COND CUOTA', 260)], existing, ctx)
    expect(far[0].kind).toBe('new')
  })

  it('un cargo de otro mes no coincide con el fijo', () => {
    expect(classifyCharges([charge('2026-09-30', 'COND CUOTA', 200)], [], ctx)[0].kind).toBe('new')
  })
})

describe('tolerancias de duplicado', () => {
  const super342 = tx('t', '2026-10-03', 'Super La Torre', 342.5, 'sup')
  it('Q 345 con 4 días de diferencia sí; Q 360 no', () => {
    expect(classifyCharges([charge('2026-10-07', 'SUPERMERCADOS LA TORRE Z10', 345)], [super342], ctx)[0].kind).toBe('duplicate')
    expect(classifyCharges([charge('2026-10-07', 'SUPERMERCADOS LA TORRE Z10', 360)], [super342], ctx)[0].kind).toBe('new')
  })

  it('6 días no', () => {
    expect(classifyCharges([charge('2026-10-09', 'SUPERMERCADOS LA TORRE Z10', 342.5)], [super342], ctx)[0].kind).toBe('new')
  })

  it('pide la misma categoría o la primera palabra en la descripción del banco', () => {
    const otherCat = tx('t', '2026-10-03', 'Farmacia Galeno', 100, 'ser')
    expect(couldBeSamePayment(charge('2026-10-03', 'GALENO Z9', 100), 'sup', otherCat)).toBe(false)
    expect(couldBeSamePayment(charge('2026-10-03', 'FARMACIA GALENO Z9', 100), 'sup', otherCat)).toBe(true)
    expect(couldBeSamePayment(charge('2026-10-03', 'GALENO Z9', 100), 'ser', otherCat)).toBe(true)
  })

  it('no empareja con lo que ya vino de un estado de cuenta', () => {
    const fromBank = tx('t', '2026-10-03', 'Super La Torre', 342.5, 'sup', { statement_import_id: 'x', bank_description: 'OTRA' })
    expect(classifyCharges([charge('2026-10-03', 'SUPERMERCADOS LA TORRE Z10', 342.5)], [fromBank], ctx)[0].kind).toBe('new')
  })
})

describe('emparejamiento uno a uno', () => {
  it('una transacción solo se empareja con un cargo, el de fecha más cercana', () => {
    const one = [tx('t', '2026-10-03', 'Uber', 38, null)]
    const r = classifyCharges([
      charge('2026-10-05', 'UBER TRIP', 38),
      charge('2026-10-03', 'UBER TRIP', 38),
    ], one, ctx)
    expect(r.map((x) => x.kind)).toEqual(['new', 'duplicate'])
    expect(r[1].matchId).toBe('t')
  })

  it('dos cargos y dos registros iguales: uno con cada uno', () => {
    const two = [tx('a', '2026-10-01', 'Uber', 38, null), tx('b', '2026-10-04', 'Uber', 38, null)]
    const r = classifyCharges([charge('2026-10-04', 'UBER', 38), charge('2026-10-01', 'UBER', 38)], two, ctx)
    expect(r.map((x) => x.matchId)).toEqual(['b', 'a'])
  })
})

describe('suggestCategory', () => {
  it('la regla del comercio gana', () => {
    const r = suggestCategory({ description: 'NETFLIX.COM', category_id: 'x' }, { ...ctx, overrides: [{ merchant_key: 'netflix.com', category_id: 'ser' }] })
    expect(r.categoryId).toBe('ser')
  })
  it('si nada coincide, usa la sugerencia de la extracción', () => {
    expect(suggestCategory({ description: 'TIENDA XYZ', category_id: 'sup' }, ctx)).toEqual({ categoryId: 'sup', subItemId: null })
  })
  it('renta por palabra clave', () => {
    expect(suggestCategory({ description: 'PAGO ALQUILER OCT' }, ctx)).toEqual({ categoryId: 'viv', subItemId: 'renta' })
  })
})

describe('cleanBankName', () => {
  it('mayúscula inicial', () => {
    expect(cleanBankName('SUPERMERCADOS  LA TORRE Z10')).toBe('Supermercados La Torre Z10')
  })
})
