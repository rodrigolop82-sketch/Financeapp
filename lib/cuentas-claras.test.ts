import { describe, it, expect } from 'vitest'
import { balanceOf, shareOf, summarizeMonth, type HomeTx } from './cuentas-claras'
import type { Person } from './hogar'

const ana: Person = { id: 'ana', name: 'Ana', fullName: 'Ana', owner: true, access: 'full', monthlyIncome: 6500 }
const luis: Person = { id: 'luis', name: 'Luis', fullName: 'Luis', owner: false, access: 'full', monthlyIncome: 4500 }

// Los datos del prototipo: Ana pagó 4970 compartido, Luis 1989.
const txs: HomeTx[] = [
  { amount: 3500, paid_by: 'ana', scope: 'shared', category_id: 'viv' },
  { amount: 820, paid_by: 'ana', scope: 'shared', category_id: 'ali' },
  { amount: 560, paid_by: 'luis', scope: 'shared', category_id: 'ali' },
  { amount: 180, paid_by: 'ana', scope: 'shared', category_id: 'tra' },
  { amount: 540, paid_by: 'luis', scope: 'shared', category_id: 'tra' },
  { amount: 609, paid_by: 'luis', scope: 'shared', category_id: 'ser' },
  { amount: 260, paid_by: 'ana', scope: 'shared', category_id: 'res' },
  { amount: 280, paid_by: 'luis', scope: 'shared', category_id: 'res' },
  { amount: 210, paid_by: 'ana', scope: 'shared', category_id: 'sal' },
  { amount: 300, paid_by: 'ana', scope: 'personal', category_id: 'ropa' },
  { amount: 250, paid_by: 'luis', scope: 'personal', category_id: 'gym' },
]

describe('summarizeMonth', () => {
  it('separa compartido y personal por persona y por categoría', () => {
    const m = summarizeMonth(txs, 'ana')
    expect(m.shared).toBe(6959)
    expect(m.personal).toBe(550)
    expect(m.paidShared).toEqual({ ana: 4970, luis: 1989 })
    expect(m.personalBy).toEqual({ ana: 300, luis: 250 })
    expect(m.categories[0]).toEqual({ categoryId: 'viv', total: 3500, by: { ana: 3500 } })
    expect(m.categories.find((c) => c.categoryId === 'ali')?.by).toEqual({ ana: 820, luis: 560 })
  })
  it('sin paid_by cuenta como del dueño', () => {
    expect(summarizeMonth([{ amount: 10, paid_by: null, scope: null, category_id: null }], 'ana').paidShared).toEqual({ ana: 10 })
  })
})

describe('cuentas claras', () => {
  const m = summarizeMonth(txs, 'ana')
  it('bolsa común no lleva cuentas', () => {
    expect(balanceOf(m, 'pool', ana, luis, [])).toBeNull()
  })
  it('mitad y mitad', () => {
    const b = balanceOf(m, 'half', ana, luis, [])!
    expect(b.from.id).toBe('luis')
    expect(b.to.id).toBe('ana')
    expect(b.amount).toBeCloseTo(4970 - 6959 / 2)
  })
  it('según ingresos (59/41)', () => {
    expect(shareOf('income', ana, luis)).toBeCloseTo(6500 / 11000)
    const b = balanceOf(m, 'income', ana, luis, [])!
    expect(b.pctA).toBe(59)
    expect(b.amount).toBeCloseTo(4970 - 6959 * (6500 / 11000))
  })
  it('lo saldado descuenta, y a mano no muestra nada', () => {
    const b = balanceOf(m, 'half', ana, luis, [])!
    expect(balanceOf(m, 'half', ana, luis, [{ from_user: 'luis', to_user: 'ana', amount: b.amount }])).toBeNull()
    const partial = balanceOf(m, 'half', ana, luis, [{ from_user: 'luis', to_user: 'ana', amount: 500 }])!
    expect(partial.amount).toBeCloseTo(b.amount - 500)
  })
  it('según ingresos sin un ingreso: no se calcula', () => {
    expect(balanceOf(m, 'income', ana, { ...luis, monthlyIncome: null }, [])).toBeNull()
  })
})
