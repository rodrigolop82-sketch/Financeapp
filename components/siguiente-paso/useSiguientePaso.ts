'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { localMonth } from '@/lib/dates'
import { loadScoreInput } from '@/lib/health-data'
import { calculateScore, type HealthScoreResult, type ScoreInput } from '@/lib/score-calculator'
import { categoriasPasadas, siguientesPasos, type DeudaPaso, type Paso, type PasosContexto } from '@/lib/siguiente-paso'

export interface SiguientePasoState {
  loading: boolean
  input: ScoreInput | null
  score: HealthScoreResult | null
  ctx: PasosContexto | null
  pasos: Paso[]
}

/**
 * Lee las mismas entradas que la salud financiera (loadScoreInput) y las
 * deudas con su interés, y elige los pasos. Solo lectura: no guarda nada.
 */
export function useSiguientePaso(householdId: string | null, reloadKey = 0): SiguientePasoState {
  const [state, setState] = useState<SiguientePasoState>({ loading: true, input: null, score: null, ctx: null, pasos: [] })

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const month = localMonth()
      const [{ input, raw }, debtsRes] = await Promise.all([
        loadScoreInput(supabase, { householdId, userId: user.id, month }),
        supabase.from('debts').select('id, name, balance, interest_rate, min_payment').eq('household_id', householdId).eq('is_paid', false),
      ])
      if (cancelled) return
      const ctx: PasosContexto = {
        debts: (debtsRes.data ?? []) as DeudaPaso[],
        overCategories: categoriasPasadas(raw.categories, raw.subItems, raw.txs, month),
      }
      setState({ loading: false, input, score: calculateScore(input), ctx, pasos: siguientesPasos(input, ctx) })
    })()
    return () => { cancelled = true }
  }, [householdId, reloadKey])

  return state
}
