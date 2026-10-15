import { describe, it, expect, vi, afterEach } from 'vitest'
import { FakeDb } from '../test-utils/fake-supabase'
import { sendMonthlySummaries, sendResumenToUser, type ResumenUser } from './envio'
import type { ResumenMensualInput } from './plantilla'
import type { SupabaseClient } from '@supabase/supabase-js'

const user: ResumenUser = { id: 'u1', email: 'prueba@gmail.com', full_name: 'Ana Pérez' }

const data: ResumenMensualInput = {
  firstName: 'Ana', monthName: 'septiembre', appUrl: 'https://example.com', fmt: (n) => `Q ${n}`,
  score: { total: 70, prev: 65 }, budget: null, goal: null, step: null,
}

function db(prefOn: boolean) {
  return new FakeDb(
    { notification_preferences: [{ user_id: 'u1', resumen_mensual_correo: prefOn }], monthly_email_log: [] },
    // FakeDb solo maneja llaves de una columna; con un solo usuario, month basta.
    { monthly_email_log: ['month'] },
  )
}
const asAdmin = (d: FakeDb) => d as unknown as SupabaseClient

describe('sendResumenToUser', () => {
  it('con la preferencia apagada no sale nada', async () => {
    const send = vi.fn()
    const d = db(false)
    expect(await sendResumenToUser(asAdmin(d), user, '2026-09', { build: async () => data, send })).toBe('pref_off')
    expect(send).not.toHaveBeenCalled()
    expect(d.rows('monthly_email_log')).toHaveLength(0)
  })

  it('un segundo disparo en el mismo mes no duplica el envío', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, id: 'x' })
    const d = db(true)
    expect(await sendResumenToUser(asAdmin(d), user, '2026-09', { build: async () => data, send })).toBe('sent')
    expect(await sendResumenToUser(asAdmin(d), user, '2026-09', { build: async () => data, send })).toBe('already')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'prueba@gmail.com', subject: 'Así cerró tu septiembre' })
  })

  it('si el envío falla, libera el mes para reintentar', async () => {
    const d = db(true)
    const fail = vi.fn().mockResolvedValue({ ok: false, skipped: false, error: 'x' })
    expect(await sendResumenToUser(asAdmin(d), user, '2026-09', { build: async () => data, send: fail })).toBe('error')
    expect(d.rows('monthly_email_log')).toHaveLength(0)
    const ok = vi.fn().mockResolvedValue({ ok: true, id: 'y' })
    expect(await sendResumenToUser(asAdmin(d), user, '2026-09', { build: async () => data, send: ok })).toBe('sent')
  })
})

describe('sendMonthlySummaries', () => {
  afterEach(() => { delete process.env.RESUMEN_MENSUAL_ENABLED })

  it('solo el día 1', async () => {
    process.env.RESUMEN_MENSUAL_ENABLED = 'true'
    expect(await sendMonthlySummaries(asAdmin(db(true)), '2026-10-02')).toEqual({ skipped: 'not_day_1' })
  })

  it('apagado por defecto (sin RESUMEN_MENSUAL_ENABLED)', async () => {
    expect(await sendMonthlySummaries(asAdmin(db(true)), '2026-10-01')).toEqual({ skipped: 'disabled' })
  })
})
