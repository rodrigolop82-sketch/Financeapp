import { describe, it, expect, vi, beforeEach } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    user: { id: 'u1' } as { id: string } | null,
    subs: [] as { provider_subscription_id: string | null; status: string | null }[],
    shots: [] as { screenshot_path: string }[],
    cancelFails: false,
    rpcError: null as { message: string } | null,
    calls: [] as string[],
  },
}))

vi.mock('@/lib/billing/server', () => ({
  sessionUser: async () => state.user,
  adminClient: () => ({
    from: (table: string) => {
      // subscriptions termina en .eq(); feedback en .not().
      if (table === 'subscriptions') return { select: () => ({ eq: () => Promise.resolve({ data: state.subs, error: null }) }) }
      const chain = { select: () => chain, eq: () => chain, not: () => Promise.resolve({ data: state.shots, error: null }) }
      return chain
    },
    storage: { from: () => ({ remove: async (paths: string[]) => { state.calls.push(`remove:${paths.join(',')}`); return {} } }) },
    rpc: async (fn: string, args: { p_user: string }) => { state.calls.push(`rpc:${fn}:${args.p_user}`); return { error: state.rpcError } },
  }),
}))
vi.mock('@/lib/billing', () => ({
  billing: () => ({
    cancel: async (id: string, opts: { atPeriodEnd: boolean }) => {
      state.calls.push(`cancel:${id}:${opts.atPeriodEnd}`)
      if (state.cancelFails) throw new Error('recurrente caído')
      return { deferred: false }
    },
  }),
}))
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({ auth: { signOut: async () => { state.calls.push('signOut') } } }),
}))

import { POST } from '@/app/api/cuenta/eliminar/route'
import { confirmacionValida, suscripcionesPorCancelar } from './eliminar-cuenta'

const req = (body: unknown) => new Request('http://x/api/cuenta/eliminar', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/cuenta/eliminar', () => {
  beforeEach(() => {
    Object.assign(state, { user: { id: 'u1' }, subs: [], shots: [], cancelFails: false, rpcError: null, calls: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('sin sesión no hace nada', async () => {
    state.user = null
    expect((await POST(req({ confirmacion: 'ELIMINAR' }))).status).toBe(401)
    expect(state.calls).toEqual([])
  })

  it('exige escribir ELIMINAR', async () => {
    expect((await POST(req({ confirmacion: 'borrar' }))).status).toBe(400)
    expect((await POST(req({}))).status).toBe(400)
    expect(state.calls).toEqual([])
  })

  it('cancela el plan activo, borra capturas, borra la cuenta y cierra sesión (en ese orden)', async () => {
    state.subs = [
      { provider_subscription_id: 'sub_1', status: 'active' },
      { provider_subscription_id: 'sub_viejo', status: 'cancelled' },
    ]
    state.shots = [{ screenshot_path: 'u1/a.png' }]
    const res = await POST(req({ confirmacion: ' eliminar ' }))
    expect(res.status).toBe(200)
    expect(state.calls).toEqual(['cancel:sub_1:false', 'remove:u1/a.png', 'rpc:eliminar_cuenta:u1', 'signOut'])
  })

  it('si no se pudo cancelar el plan, no borra nada', async () => {
    state.subs = [{ provider_subscription_id: 'sub_1', status: 'active' }]
    state.cancelFails = true
    const res = await POST(req({ confirmacion: 'ELIMINAR' }))
    expect(res.status).toBe(502)
    expect(state.calls.some((c) => c.startsWith('rpc:'))).toBe(false)
  })

  it('si el borrado falla, no cierra la sesión', async () => {
    state.rpcError = { message: 'boom' }
    const res = await POST(req({ confirmacion: 'ELIMINAR' }))
    expect(res.status).toBe(500)
    expect(state.calls).not.toContain('signOut')
  })
})

describe('reglas', () => {
  it('confirmación', () => {
    expect(confirmacionValida('ELIMINAR')).toBe(true)
    expect(confirmacionValida('eliminar')).toBe(true)
    expect(confirmacionValida('ELIMINA')).toBe(false)
    expect(confirmacionValida(undefined)).toBe(false)
  })
  it('solo cancela suscripciones vivas', () => {
    expect(suscripcionesPorCancelar([
      { provider_subscription_id: 'a', status: 'active' },
      { provider_subscription_id: 'b', status: 'past_due' },
      { provider_subscription_id: 'c', status: 'cancelled' },
      { provider_subscription_id: null, status: 'active' },
      { provider_subscription_id: 'code_r1', status: 'active', provider: 'code' },
    ])).toEqual(['a', 'b'])
  })
})
