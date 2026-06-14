'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { projectGoal, type ProjectionResult } from '@/lib/goal-projector'

export type GoalType = 'emergency_fund' | 'travel' | 'vehicle' | 'education' | 'investment' | 'custom'
export type GoalStatus = 'active' | 'completed' | 'paused'

export interface Goal {
  id: string
  name: string
  emoji: string
  targetAmount: number
  currentAmount: number
  monthlyContribution: number | null
  targetDate: string | null
  goalType: GoalType
  status: GoalStatus
  projection: ProjectionResult
}

export interface Contribution {
  id: string
  amount: number
  note: string | null
  createdAt: string
}

export interface CreateGoalInput {
  name: string
  emoji: string
  targetAmount: number
  monthlyContribution: number | null
  targetDate: string | null
  goalType: GoalType
}

export interface UseGoalsReturn {
  goals: Goal[]
  totalSaved: number
  totalTarget: number
  isLoading: boolean
  error: string | null
  createGoal: (input: CreateGoalInput) => Promise<void>
  addContribution: (goalId: string, amount: number, note?: string) => Promise<void>
  getContributionHistory: (goalId: string) => Promise<Contribution[]>
  avgMonthlyExpenses: number
  avgMonthlySavings: number
  reload: () => void
}

export function useGoals(): UseGoalsReturn {
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avgMonthlyExpenses, setAvgMonthlyExpenses] = useState(0)
  const [avgMonthlySavings, setAvgMonthlySavings] = useState(0)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('No autenticado')
        setIsLoading(false)
        return
      }

      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single()

      const householdId = household?.id as string | undefined

      // Fetch goals + monthly averages in parallel
      const [goalsRes, avgRes, profileRes] = await Promise.all([
        supabase
          .from('financial_goals')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        householdId ? computeMonthlyAverages(supabase, householdId) : Promise.resolve({ expenses: 0, savings: 0 }),
        householdId
          ? supabase.from('financial_profiles').select('total_income').eq('household_id', householdId).order('updated_at', { ascending: false }).limit(1).single()
          : Promise.resolve({ data: null }),
      ])

      if (goalsRes.error) {
        setError('Error al cargar metas')
        setIsLoading(false)
        return
      }

      const monthlyIncome = Number(profileRes.data?.total_income ?? 0)
      const expenses = avgRes.expenses
      const savings = monthlyIncome > 0 ? Math.max(0, monthlyIncome - expenses) : 0

      setAvgMonthlyExpenses(expenses)
      setAvgMonthlySavings(savings)

      const mapped: Goal[] = (goalsRes.data ?? []).map((g) => ({
        id: g.id as string,
        name: g.name as string,
        emoji: (g.emoji as string) || '🎯',
        targetAmount: Number(g.target_amount),
        currentAmount: Number(g.current_amount),
        monthlyContribution: g.monthly_contribution ? Number(g.monthly_contribution) : null,
        targetDate: g.target_date as string | null,
        goalType: g.goal_type as GoalType,
        status: g.status as GoalStatus,
        projection: projectGoal({
          targetAmount: Number(g.target_amount),
          currentAmount: Number(g.current_amount),
          avgMonthlySavings: savings,
          plannedContribution: g.monthly_contribution ? Number(g.monthly_contribution) : undefined,
          targetDate: g.target_date ? new Date(g.target_date) : null,
        }),
      }))

      setGoals(mapped)
    } catch {
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createGoal = async (input: CreateGoalInput) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { error: insertError } = await supabase.from('financial_goals').insert({
      user_id: user.id,
      name: input.name,
      emoji: input.emoji,
      target_amount: input.targetAmount,
      monthly_contribution: input.monthlyContribution,
      target_date: input.targetDate,
      goal_type: input.goalType,
    })
    if (insertError) throw new Error(insertError.message)
    await load()
  }

  const addContribution = async (goalId: string, amount: number, note?: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { error: insertError } = await supabase.from('goal_contributions').insert({
      goal_id: goalId,
      user_id: user.id,
      amount,
      note: note || null,
    })
    if (insertError) throw new Error(insertError.message)
    await load()
  }

  const getContributionHistory = async (goalId: string): Promise<Contribution[]> => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('goal_contributions')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })

    if (fetchError) throw new Error(fetchError.message)
    return (data ?? []).map((c) => ({
      id: c.id as string,
      amount: Number(c.amount),
      note: c.note as string | null,
      createdAt: c.created_at as string,
    }))
  }

  const totalSaved = goals.filter(g => g.status === 'active').reduce((s, g) => s + g.currentAmount, 0)
  const totalTarget = goals.filter(g => g.status === 'active').reduce((s, g) => s + g.targetAmount, 0)

  return {
    goals, totalSaved, totalTarget, isLoading, error,
    createGoal, addContribution, getContributionHistory,
    avgMonthlyExpenses, avgMonthlySavings, reload: load,
  }
}

async function computeMonthlyAverages(
  supabase: ReturnType<typeof createClient>,
  householdId: string
): Promise<{ expenses: number; savings: number }> {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = `${currentMonthStart.getFullYear()}-${String(currentMonthStart.getMonth() + 1).padStart(2, '0')}-01`

  const { data } = await supabase
    .from('transactions')
    .select('amount, date')
    .eq('household_id', householdId)
    .gte('date', startDate)
    .lt('date', endDate)

  if (!data || data.length === 0) return { expenses: 0, savings: 0 }

  const totalExpenses = data.reduce((s, t) => s + Number(t.amount), 0)

  const months = new Set(data.map((t) => (t.date as string).slice(0, 7)))
  const monthCount = Math.max(1, months.size)

  return { expenses: Math.round(totalExpenses / monthCount), savings: 0 }
}
