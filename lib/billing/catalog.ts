import type { Cycle, Tier } from '@/lib/plans'

// Plan × ciclo → producto (o precio) de Recurrente. Los ids viven en env para
// cambiar de Sandbox a producción, o de USD a GTQ, sin tocar código.
const ENV: Record<Tier, Record<Cycle, string>> = {
  premium: { monthly: 'RECURRENTE_PRODUCT_PREMIUM_MONTHLY', annual: 'RECURRENTE_PRODUCT_PREMIUM_ANNUAL' },
  family: { monthly: 'RECURRENTE_PRODUCT_FAMILY_MONTHLY', annual: 'RECURRENTE_PRODUCT_FAMILY_ANNUAL' },
}

export function catalogId(tier: Tier, cycle: Cycle, env: Record<string, string | undefined> = process.env): string {
  const id = env[ENV[tier][cycle]]
  if (!id) throw new Error(`Falta ${ENV[tier][cycle]}`)
  return id
}

/** Lo contrario: de un id del catálogo al plan y ciclo. */
export function fromCatalogId(id: string | null | undefined, env: Record<string, string | undefined> = process.env): { tier: Tier; cycle: Cycle } | null {
  if (!id) return null
  for (const tier of ['premium', 'family'] as Tier[]) {
    for (const cycle of ['monthly', 'annual'] as Cycle[]) {
      if (env[ENV[tier][cycle]] === id) return { tier, cycle }
    }
  }
  return null
}

export function isTier(v: unknown): v is Tier {
  return v === 'premium' || v === 'family'
}

export function isCycle(v: unknown): v is Cycle {
  return v === 'monthly' || v === 'annual'
}
