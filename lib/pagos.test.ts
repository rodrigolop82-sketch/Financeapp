import { describe, it, expect } from 'vitest'
import { paidCopy, pagoStatus, pagosSummary, reminderCopy, remindersFor, sortPending, statusBadge, type Pago } from './pagos'

const base: Omit<Pago, 'id' | 'name' | 'dueDay'> = {
  kind: 'bill', emoji: '🧾', amount: 100, approx: false, responsibleId: null,
  remind3d: true, remind0d: true, notifyOther: true, categoryId: null, paid: null,
}
const p = (id: string, dueDay: number, extra: Partial<Pago> = {}): Pago => ({ ...base, id, name: id, dueDay, ...extra })
const TODAY = '2026-10-06'

describe('estado', () => {
  it('atrasado, hoy, pronto, después y pagado', () => {
    expect(pagoStatus(p('a', 5), TODAY).status).toBe('late')
    expect(pagoStatus(p('a', 6), TODAY).status).toBe('today')
    expect(pagoStatus(p('a', 8), TODAY)).toEqual({ status: 'soon', days: 2 })
    expect(pagoStatus(p('a', 15), TODAY).status).toBe('later')
    expect(pagoStatus(p('a', 1, { paid: { by: 'x', at: '2026-10-01', transactionId: null } }), TODAY).status).toBe('paid')
  })
  it('día 31 en un mes de 30 vence el último día', () => {
    expect(pagoStatus(p('a', 31), '2026-09-30').status).toBe('today')
  })
  it('badges', () => {
    expect(statusBadge(p('a', 5), TODAY)).toEqual({ text: 'Atrasado', tone: 'danger' })
    expect(statusBadge(p('a', 7), TODAY)).toEqual({ text: 'En 1 día', tone: 'warn' })
    expect(statusBadge(p('a', 20), TODAY)).toBeNull()
  })
})

describe('orden y resumen', () => {
  const list = [p('visa', 8), p('colegio', 5), p('renta', 1, { paid: { by: 'ana', at: '2026-10-01', transactionId: null }, amount: 3500 }), p('luz', 10, { amount: 410 })]
  it('atrasados primero', () => {
    expect(sortPending(list, TODAY).map((x) => x.id)).toEqual(['colegio', 'visa', 'luz'])
  })
  it('cuenta pagados y lo que falta', () => {
    expect(pagosSummary(list)).toEqual({ paid: 1, total: 4, pending: 610 })
  })
})

describe('recordatorios', () => {
  it('3 días antes y el día, al responsable o a los dos', () => {
    const list = [p('visa', 9, { responsibleId: 'luis' }), p('luz', 6), p('gym', 9, { remind3d: false }), p('agua', 20)]
    const r = remindersFor(list, TODAY, ['ana', 'luis'])
    expect(r.map((x) => [x.pago.id, x.when, x.to])).toEqual([['visa', '3d', ['luis']], ['luz', '0d', ['ana', 'luis']]])
  })
  it('textos', () => {
    const fmt = (n: number) => `Q ${n.toLocaleString('en-US')}`
    const visa = p('visa', 8, { name: 'la Tarjeta Visa', amount: 850, note: 'pago mínimo' })
    expect(reminderCopy({ pago: visa, to: ['luis'], when: '3d' }, 'Luis', '2026-10-05', fmt)).toEqual({
      title: 'Luis, la Tarjeta Visa vence el jueves',
      body: 'Pago mínimo Q 850. Toca para marcarlo como pagado.',
    })
    expect(paidCopy('Ana', p('renta', 1, { name: 'la renta', amount: 3500 }), 2, 6, 'octubre', fmt)).toEqual({
      title: 'Ana pagó la renta ✓',
      body: 'Q 3,500 · Ya van 2 de 6 pagos de octubre.',
    })
  })
})
