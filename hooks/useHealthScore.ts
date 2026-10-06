'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { calculateScore, type HealthScoreResult, type ScoreInput } from '@/lib/score-calculator'
import { loadScoreHistory, loadScoreInput, type ScoreHistoryPoint } from '@/lib/health-data'
import { rememberScore } from '@/lib/score-feedback'
import { localMonth } from '@/lib/dates'

/**
 * Salud financiera en vivo (lib/score-calculator.ts con lib/health-data.ts).
 * Con `month` de otro mes (Cerrar el mes) calcula ese mes y no guarda nada.
 */
export function useHealthScore(householdId: string | null, opts: { month?: string; history?: boolean } = {}) {
  const month = opts.month ?? localMonth()
  const withHistory = opts.history ?? false
  const [score, setScore] = useState<HealthScoreResult | null>(null)
  const [input, setInput] = useState<ScoreInput | null>(null)
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  const recalculate = useCallback(async () => {
    if (!householdId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ input: next }, hist] = await Promise.all([
      loadScoreInput(supabase, { householdId, userId: user.id, month }),
      withHistory ? loadScoreHistory(supabase, householdId) : Promise.resolve([] as ScoreHistoryPoint[]),
    ])
    const result = calculateScore(next)
    setInput(next)
    setScore(result)
    setHistory(hist)
    setLoading(false)

    if (month === localMonth() && result.components.length > 0) {
      rememberScore(householdId, result.total)
      await supabase.from('financial_profiles').update({ health_score: result.total }).eq('household_id', householdId)
    }
  }, [householdId, month, withHistory])

  useEffect(() => { void recalculate() }, [recalculate])

  return { score, input, history, loading, recalculate }
}
