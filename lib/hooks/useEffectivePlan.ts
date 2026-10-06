'use client'

import { useEffect, useState } from 'react'
import type { EffectivePlan } from '@/lib/plans'
import { fetchEffectivePlan } from '@/lib/plan-client'

// Una sola consulta por carga de la app: lo comparten la barra, la hoja de
// agregar y las pantallas. `refreshEffectivePlan()` la vuelve a pedir.
let cached: Promise<EffectivePlan | null> | null = null

export function refreshEffectivePlan(): Promise<EffectivePlan | null> {
  cached = fetchEffectivePlan()
  return cached
}

export function useEffectivePlan(): EffectivePlan | null {
  const [plan, setPlan] = useState<EffectivePlan | null>(null)
  useEffect(() => {
    let alive = true
    ;(cached ??= fetchEffectivePlan()).then((p) => { if (alive) setPlan(p) })
    return () => { alive = false }
  }, [])
  return plan
}

/** ¿Solo puede ver? (miembro con acceso 'view'). */
export function useViewOnly(): boolean {
  return useEffectivePlan()?.access === 'view'
}
