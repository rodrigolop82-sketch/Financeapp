// Suscripciones del Plan del mes (puro, para vitest). Cada parte de una
// categoría de suscripciones (o la categoría, si no tiene partes) es una
// suscripción planeada. Se cruza por nombre con los cobros que detectó
// detect.ts: así la pantalla muestra todo lo planeado aunque aún no haya
// 3 meses de cobros, y aparte lo detectado que no está en el plan.

import { categoryCapKeys, type CapCategory } from '../recomendaciones'
import { planLeaves, type PlanCategory, type PlanSubItem } from '../plan-del-mes'
import { normalizeMerchantKey, type RecurringCharge } from './detect'

export interface PlanSubscription {
  /** Id de la parte, o de la categoría si no tiene partes. */
  id: string
  name: string
  categoryName: string
  /** Equivalente mensual (una parte anual cuenta 1/12). */
  monthly: number
  expectedDay: number | null
  /** Cobro detectado que coincide por nombre. */
  merchantKey: string | null
}

export interface PlanSubscriptions {
  lines: PlanSubscription[]
  monthlyTotal: number
}

type Category = PlanCategory & CapCategory & { archived_at?: string | null }

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/** ¿El nombre de la línea del plan y la clave del comercio son el mismo servicio? */
export function namesMatch(lineKey: string, merchantKey: string): boolean {
  if (lineKey === merchantKey) return true
  const a = ` ${lineKey} `
  const b = ` ${merchantKey} `
  // Una contiene a la otra como palabras completas ("netflix" ↔ "netflix premium").
  if (a.includes(b) || b.includes(a)) return true
  // Misma primera palabra, si es distintiva ("spotify" ↔ "spotify ab").
  const first = lineKey.split(' ')[0]
  return first.length >= 4 && first === merchantKey.split(' ')[0]
}

export function planSubscriptions(
  categories: Category[],
  subs: PlanSubItem[],
  charges: Pick<RecurringCharge, 'merchantKey'>[],
): PlanSubscriptions {
  const live = categories.filter((c) => !c.archived_at)
  const caps = categoryCapKeys(live)
  const subCats = live.filter((c) => caps[c.id] === 'suscripciones')
  const catById = new Map(subCats.map((c) => [c.id, c]))
  const subById = new Map(subs.map((s) => [s.id, s]))

  const taken = new Set<string>()
  const lines: PlanSubscription[] = planLeaves(subCats, subs)
    .filter((l) => l.plan > 0)
    .map((l) => {
      const cat = catById.get(l.categoryId)!
      const name = subById.get(l.id)?.name ?? cat.name
      const key = normalizeMerchantKey(name)
      const match = key ? charges.find((c) => !taken.has(c.merchantKey) && namesMatch(key, c.merchantKey)) : undefined
      if (match) taken.add(match.merchantKey)
      return {
        id: l.id,
        name,
        categoryName: cat.name,
        monthly: r2(l.plan),
        expectedDay: l.expectedDay,
        merchantKey: match?.merchantKey ?? null,
      }
    })
    .sort((a, b) => b.monthly - a.monthly)

  return { lines, monthlyTotal: r2(lines.reduce((s, l) => s + l.monthly, 0)) }
}
