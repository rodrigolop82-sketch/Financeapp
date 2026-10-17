import { describe, it, expect, vi, beforeEach } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { plan: 'free', activos: 0, inserted: [] as { table: string; rows: unknown }[], archived: '2026-10-01T00:00:00Z' as string | null },
}))

vi.mock('@/lib/server/household-context', () => ({
  householdContext: async () => ({
    userId: 'u1', householdId: 'hh1', plan: { plan: state.plan, access: 'full' },
    admin: {
      from: (table: string) => {
        const chain: Record<string, unknown> = {}
        const self = () => chain
        Object.assign(chain, {
          select: (_c: string, opts?: { head?: boolean }) => (opts?.head ? { eq: () => ({ is: () => Promise.resolve({ count: state.activos }) }) } : chain),
          eq: self, is: self,
          maybeSingle: () => Promise.resolve({ data: { id: 'e1', archived_at: state.archived } }),
          insert: (rows: unknown) => {
            state.inserted.push({ table, rows })
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }), then: (f: (v: unknown) => void) => f({ error: null }) }
          },
          update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        })
        return chain
      },
    },
  }),
}))

import { POST } from '@/app/api/eventos/route'
import { PATCH } from '@/app/api/eventos/[id]/route'

const post = (body: unknown) => POST(new Request('http://x/api/eventos', { method: 'POST', body: JSON.stringify(body) }))
const patch = (body: unknown) => PATCH(new Request('http://x/api/eventos/e1', { method: 'PATCH', body: JSON.stringify(body) }), { params: { id: 'e1' } })

beforeEach(() => { state.plan = 'free'; state.activos = 0; state.inserted = []; state.archived = '2026-10-01T00:00:00Z' })

describe('POST /api/eventos', () => {
  it('Premium crea el evento y sus conceptos en orden', async () => {
    state.plan = 'premium'
    const res = await post({ tipo: 'cumpleanos', nombre: 'Cumple', conceptos: [{ nombre: 'Pastel', presupuesto: '450' }, { nombre: 'Lugar', presupuesto: 1500 }] })
    expect(res.status).toBe(201)
    expect(state.inserted[0].table).toBe('eventos')
    expect(state.inserted[1]).toEqual({ table: 'evento_conceptos', rows: [
      { evento_id: 'e1', household_id: 'hh1', nombre: 'Pastel', presupuesto: 450, orden: 0 },
      { evento_id: 'e1', household_id: 'hh1', nombre: 'Lugar', presupuesto: 1500, orden: 1 },
    ] })
  })
  it('Gratis: 402 y no crea nada, aunque no tenga eventos', async () => {
    state.activos = 0
    const res = await post({ tipo: 'boda', nombre: 'Boda' })
    expect(res.status).toBe(402)
    expect(state.inserted).toEqual([])
  })
  it('Premium crea aunque tenga varios activos', async () => {
    state.plan = 'premium'
    state.activos = 3
    expect((await post({ tipo: 'boda', nombre: 'Boda' })).status).toBe(201)
  })
  it('datos inválidos: 400', async () => {
    state.plan = 'premium'
    expect((await post({ tipo: 'boda', nombre: '' })).status).toBe(400)
  })
})

describe('PATCH /api/eventos/[id]', () => {
  it('reactivar en Premium: 200', async () => {
    state.plan = 'premium'
    expect((await patch({ archivado: false })).status).toBe(200)
  })
  it('reactivar en Gratis: 402', async () => {
    expect((await patch({ archivado: false })).status).toBe(402)
  })
  it('terminar siempre se puede, también en Gratis', async () => {
    state.archived = null
    expect((await patch({ archivado: true })).status).toBe(200)
  })
  it('sin archivado booleano: 400', async () => {
    expect((await patch({})).status).toBe(400)
  })
})
