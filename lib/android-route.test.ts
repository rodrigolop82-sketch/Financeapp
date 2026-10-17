import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { state } = vi.hoisted(() => ({
  state: {
    ia: { status: 'ok', result: { amount: 85.5, merchant: 'Walmart', bank: 'BAM', currency: 'GTQ', type: 'expense' } } as unknown,
    calls: [] as string[],
    charges: [] as { charge: unknown; opts: unknown }[],
    duplicate: false,
  },
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({}) }))
vi.mock('@/lib/plans', () => ({ getEffectivePlan: async () => ({ access: 'full' }) }))
vi.mock('@/lib/dates', () => ({ localToday: () => '2026-10-17' }))
vi.mock('@/lib/notificacion-ia', () => ({
  extraerNotificacion: async () => { state.calls.push('ia'); return state.ia },
}))
vi.mock('@/lib/apple-pay-server', () => ({
  findShortcutToken: async () => ({ id: 't1', user_id: 'u1', revoked_at: null, rate_window_start: null, rate_window_count: 0 }),
  touchShortcutToken: async () => { state.calls.push('touch'); return true },
  registerApplePayCharge: async (_a: unknown, _u: string, charge: { amount: number; merchant: string; date: string }, opts: unknown) => {
    state.charges.push({ charge, opts })
    return { ok: true, value: { id: 'tx1', amount: charge.amount, merchant: charge.merchant, date: charge.date, categoryId: null, categoryName: null, remembered: false, pushed: true, duplicate: state.duplicate } }
  },
}))

import { POST } from '@/app/api/parse-notification/route'

const TOKEN = 'zafi_' + 'a'.repeat(43)

function req(body: string, contentType = 'text/plain') {
  return new NextRequest('https://zafi.test/api/parse-notification', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': contentType },
    body,
  })
}

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  state.ia = { status: 'ok', result: { amount: 85.5, merchant: 'Walmart', bank: 'BAM', currency: 'GTQ', type: 'expense' } }
  state.calls = []
  state.charges = []
  state.duplicate = false
})

describe('POST /api/parse-notification con clave (Android, C15)', () => {
  it('aviso con monto: se interpreta y se registra como android', async () => {
    const res = await POST(req('BAM: Compra por Q85.50 en WALMART'))
    expect(res.status).toBe(201)
    expect(state.calls).toEqual(['touch', 'ia'])
    expect(state.charges[0]).toEqual({
      charge: { amount: 85.5, currency: 'GTQ', merchant: 'Walmart', card: 'BAM', date: '2026-10-17' },
      opts: { source: 'android', via: 'por el aviso de BAM' },
    })
  })

  it('aviso sin monto: 200 ignorado, sin IA ni límite', async () => {
    const res = await POST(req('Tu código de verificación es 482913'))
    expect(res.status).toBe(200)
    expect((await res.json()).reason).toBe('no_es_cobro')
    expect(state.calls).toEqual([])
    expect(state.charges).toEqual([])
  })

  it('ingreso: 200 ignorado', async () => {
    state.ia = { status: 'ok', result: { amount: 500, merchant: '', bank: 'BAM', currency: 'GTQ', type: 'income' } }
    const res = await POST(req('BAM: Depósito acreditado por Q500.00'))
    expect(res.status).toBe(200)
    expect((await res.json()).reason).toBe('ingreso')
    expect(state.charges).toEqual([])
  })

  it('JSON { text, app } también funciona; aviso repetido → 200 sin crear otro', async () => {
    state.duplicate = true
    const res = await POST(req(JSON.stringify({ text: 'Compra por Q85.50 en "WALMART"', app: 'BAM' }), 'application/json'))
    expect(res.status).toBe(200)
    expect((await res.json()).duplicate).toBe(true)
  })

  it('el atajo de Apple Pay sigue igual', async () => {
    const res = await POST(req(JSON.stringify({ amount: '1.00', merchant: 'Prueba de Apple Pay', card: 'Prueba', date: '2026-10-17' }), 'application/json'))
    expect(res.status).toBe(201)
    expect(state.calls).toEqual(['touch'])
    expect(state.charges[0].opts).toEqual({ source: 'apple_pay', via: 'con Apple Pay' })
  })
})
