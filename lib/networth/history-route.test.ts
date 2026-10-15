import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/networth/history/route'

const { ctx, hasFeature, series } = vi.hoisted(() => ({
  ctx: { userId: 'u1', householdId: 'h1', plan: { access: 'full' }, admin: {} },
  hasFeature: vi.fn(),
  series: vi.fn(),
}))

vi.mock('@/lib/server/household-context', () => ({ householdContext: async () => ctx }))
vi.mock('@/lib/entitlements/features', () => ({ hasFeature: (...a: unknown[]) => hasFeature(...a), PREMIUM_REQUIRED: 'Esta función es parte de Premium' }))
vi.mock('@/lib/networth/data', () => ({ getNetWorthHistorySeries: (...a: unknown[]) => series(...a) }))
vi.mock('@/lib/networth/manual-server', () => ({ loadManualMonths: async () => [] }))


describe('GET /api/networth/history (gating en servidor)', () => {
  beforeEach(() => { hasFeature.mockReset(); series.mockReset() })

  it('hogar gratis: 403 y no se calcula ni devuelve la serie', async () => {
    hasFeature.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.series).toBeUndefined()
    expect(series).not.toHaveBeenCalled()
    expect(hasFeature).toHaveBeenCalledWith('h1', 'networth.history')
  })

  it('hogar Premium: devuelve la serie', async () => {
    hasFeature.mockResolvedValue(true)
    series.mockResolvedValue([{ month: '2026-09', netWorth: 1000 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).series).toEqual([{ month: '2026-09', netWorth: 1000, origin: 'auto' }])
  })
})
