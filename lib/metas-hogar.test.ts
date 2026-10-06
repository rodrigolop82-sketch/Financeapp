import { describe, it, expect } from 'vitest'
import { contributionsBy, monthlySplit, roundUp10 } from './metas-hogar'
import type { Person } from './hogar'

const ana: Person = { id: 'ana', name: 'Ana', fullName: 'Ana', owner: true, access: 'full', monthlyIncome: 6500 }
const luis: Person = { id: 'luis', name: 'Luis', fullName: 'Luis', owner: false, access: 'full', monthlyIncome: 4500 }

describe('metas del hogar', () => {
  it('suma por persona (sin usuario: el dueño)', () => {
    expect(contributionsBy([{ userId: 'ana', amount: 600 }, { userId: 'luis', amount: 400 }, { userId: null, amount: 100 }], 'ana')).toEqual({ ana: 700, luis: 400 })
  })
  it('reparte el aporte del mes', () => {
    expect(roundUp10(857.1)).toBe(860)
    expect(monthlySplit(857.1, 'income', ana, luis)).toEqual({ total: 860, parts: [510, 350], byIncome: true })
    expect(monthlySplit(900, 'half', ana, luis)).toEqual({ total: 900, parts: [450, 450], byIncome: false })
    expect(monthlySplit(900, 'income', ana, { ...luis, monthlyIncome: null }).byIncome).toBe(false)
  })
})
