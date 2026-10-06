import type { EffectivePlan } from './plans'

/** Plan efectivo desde el navegador (null si no se pudo leer). */
export async function fetchEffectivePlan(): Promise<EffectivePlan | null> {
  try {
    const res = await fetch('/api/billing/plan', { cache: 'no-store' })
    return res.ok ? ((await res.json()) as EffectivePlan) : null
  } catch {
    return null
  }
}
