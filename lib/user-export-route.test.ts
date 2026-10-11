import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/user/export/route'

const { state } = vi.hoisted(() => ({ state: { failTable: null as string | null, selects: {} as Record<string, string> } }))

vi.mock('@/lib/audit', () => ({ logAuditEvent: async () => {} }))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      const result = state.failTable === table
        ? { data: null, error: { message: 'column does not exist' } }
        : { data: [{ id: `${table}-1` }], error: null }
      const chain = {
        select: (cols: string) => { state.selects[table] = cols; return chain },
        eq: () => chain,
        order: () => Promise.resolve(result),
      }
      return chain
    },
  }),
}))

describe('GET /api/user/export', () => {
  beforeEach(() => { state.failTable = null; state.selects = {} })

  it('exporta todas las tablas con las columnas reales de deudas y planes', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = JSON.parse(await res.text())
    expect(body.data.debts).toEqual([{ id: 'debts-1' }])
    expect(state.selects.debts).toContain('min_payment')
    expect(state.selects.debts).not.toContain('minimum_payment')
    expect(state.selects.action_plans).not.toContain('plan_data')
  })

  it('si una tabla falla, no entrega una exportación incompleta', async () => {
    state.failTable = 'debts'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
