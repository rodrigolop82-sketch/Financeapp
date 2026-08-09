'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { calculateDynamicScore, type HealthScoreResult } from '@/lib/score-calculator'
import { localMonthStart } from '@/lib/dates'

interface HistoryPoint {
  month: string
  score: number
}

export function useHealthScore(householdId: string | null) {
  const [score, setScore] = useState<HealthScoreResult | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  const recalculate = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const supabase = createClient()
    const monthStart = localMonthStart()
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

    const [profileRes, txRes, snapshotRes] = await Promise.all([
      supabase
        .from('financial_profiles')
        .select('*')
        .eq('household_id', householdId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('transactions')
        .select('amount')
        .eq('household_id', householdId)
        .gte('date', monthStart)
        .lt('date', nextMonthStr),
      supabase
        .from('monthly_snapshots')
        .select('month, health_score')
        .eq('household_id', householdId)
        .order('month', { ascending: true })
        .limit(12),
    ])

    const profile = profileRes.data
    const spentThisMonth = (txRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0)

    if (profile) {
      const result = calculateDynamicScore({
        totalIncome: Number(profile.total_income),
        totalFixedExpenses: Number(profile.total_fixed_expenses),
        totalDebt: Number(profile.total_debt),
        totalSavings: Number(profile.total_savings),
        hasEmergencyFund: profile.has_emergency_fund,
        incomeType: profile.income_type,
        spentThisMonth,
      })
      setScore(result)

      // Persist updated score
      await supabase
        .from('financial_profiles')
        .update({ health_score: result.total })
        .eq('household_id', householdId)
    }

    const historyData: HistoryPoint[] = (snapshotRes.data ?? [])
      .filter((s) => s.health_score != null)
      .map((s) => ({
        month: s.month,
        score: s.health_score,
      }))
    setHistory(historyData)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    recalculate()
  }, [recalculate])

  return { score, history, loading, recalculate }
}
