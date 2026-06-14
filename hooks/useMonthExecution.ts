'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo } from '@/lib/dates'
import { buildSmartAlert, type AlertData } from '@/components/dashboard/SmartAlert'
import type { BudgetCategory, Transaction } from '@/types'

export interface CategoryExecution extends BudgetCategory {
  spentAmount: number
  percentage: number
  status: 'ok' | 'near' | 'over'
}

export interface MonthExecutionData {
  spentMonth: number
  spentLastMonth: number
  monthDeltaPct: number
  budget: number
  daysLeft: number
  daysInMonth: number
  dailyAvg: number
  projectedSavings: number
  currentStreak: number
  bestStreak: number
  weekDayStatus: ('done' | 'today' | 'miss')[]
  categories: CategoryExecution[]
  alert: AlertData | null
  householdId: string
}

export function useMonthExecution() {
  const [data, setData] = useState<MonthExecutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('No autenticado'); return }

      const { data: household } = await supabase
        .from('households').select('id').eq('owner_id', user.id).limit(1).single()
      if (!household) { setError('Sin hogar'); return }

      const hid = household.id as string
      const now = new Date()
      const monthStart = localMonthStart()
      const today = localToday()
      const weekStart = localDaysAgo(7)
      const prevWeekStart = localDaysAgo(14)

      // Previous month range
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`

      const [txMonthRes, categoriesRes, profileRes, tx90Res, txPrevWeekRes, txPrevMonthRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart).order('date', { ascending: false }),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('financial_profiles').select('total_income').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
        supabase.from('transactions').select('date').eq('household_id', hid).gte('date', localDaysAgo(90)),
        supabase.from('transactions').select('amount').eq('household_id', hid).gte('date', prevWeekStart).lt('date', weekStart),
        supabase.from('transactions').select('amount').eq('household_id', hid).gte('date', prevMonthStart).lt('date', monthStart),
      ])

      const txMonth = (txMonthRes.data ?? []) as Transaction[]
      const categories = (categoriesRes.data ?? []) as BudgetCategory[]
      const totalIncome = profileRes.data ? Number(profileRes.data.total_income) : 0
      const spentLastMonth = (txPrevMonthRes.data ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daysLeft = daysInMonth - now.getDate()
      const daysPassed = daysInMonth - daysLeft

      const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
      const budget = totalIncome > 0 ? totalIncome * 0.8 : categories.reduce((s, c) => s + Number(c.budgeted_amount), 0)
      const dailyAvg = daysPassed > 0 ? spentMonth / daysPassed : 0
      const projectedTotal = dailyAvg * daysInMonth
      const projectedSavings = budget - projectedTotal

      // Spending by category
      const spentByCat: Record<string, number> = {}
      txMonth.forEach((t) => { spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount) })

      const categoryExecution: CategoryExecution[] = categories.map((c) => {
        const spent = spentByCat[c.id] ?? 0
        const pct = c.budgeted_amount > 0 ? Math.min(Math.round(spent / c.budgeted_amount * 100), 999) : 0
        return {
          ...c,
          spentAmount: spent,
          percentage: pct,
          status: (pct >= 100 ? 'over' : pct >= 80 ? 'near' : 'ok') as 'ok' | 'near' | 'over',
        }
      }).sort((a, b) => b.spentAmount - a.spentAmount)

      // Alert
      const spentPrevWeek = (txPrevWeekRes.data ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      const spentWeek = txMonth.filter((t) => t.date >= weekStart).reduce((s, t) => s + Number(t.amount), 0)
      const lastTxDate = txMonth[0]?.date
      const daysSinceLast = lastTxDate
        ? Math.floor((now.getTime() - new Date(lastTxDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
        : 999
      let topOver: { name: string; spent: number; limit: number; pctOver: number } | undefined
      categoryExecution.forEach((c) => {
        const over = c.budgeted_amount > 0 ? (c.spentAmount - c.budgeted_amount) / c.budgeted_amount * 100 : 0
        if (over > 20 && (!topOver || over > topOver.pctOver)) {
          topOver = { name: c.name, spent: c.spentAmount, limit: c.budgeted_amount, pctOver: Math.round(over) }
        }
      })
      const alert = buildSmartAlert({ spent: spentMonth, budget, daysLeft, daysInMonth, topOverBudgetCategory: topOver, daysSinceLastTransaction: daysSinceLast })

      // Streak
      const txDates = new Set(txMonth.map((t) => t.date))
      let currentStreak = 0
      let streakOffset = txDates.has(today) ? 0 : 1
      while (true) {
        const ds = localDaysAgo(streakOffset)
        if (txDates.has(ds)) { currentStreak++; streakOffset++ } else { break }
      }

      const tx90Dates = Array.from(new Set((tx90Res.data ?? []).map((t: { date: string }) => t.date))).sort() as string[]
      let bestStreak = currentStreak
      let tempStreak = 0
      let prevDate: string | null = null
      for (const dateStr of tx90Dates) {
        if (prevDate === null) {
          tempStreak = 1
        } else {
          const diffDays = Math.round((new Date(dateStr + 'T12:00:00').getTime() - new Date(prevDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
          tempStreak = diffDays === 1 ? tempStreak + 1 : 1
        }
        bestStreak = Math.max(bestStreak, tempStreak)
        prevDate = dateStr
      }

      const weekDayStatus: ('done' | 'today' | 'miss')[] = Array.from({ length: 7 }, (_, i) => {
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
        const ds = localDaysAgo(dayOfWeek - i)
        if (ds === today) return 'today'
        if (txDates.has(ds)) return 'done'
        return 'miss'
      })

      const monthDeltaPct = spentLastMonth > 0 ? Math.round(((spentMonth - spentLastMonth) / spentLastMonth) * 100) : 0

      setData({ spentMonth, spentLastMonth, monthDeltaPct, budget, daysLeft, daysInMonth, dailyAvg, projectedSavings, currentStreak, bestStreak, weekDayStatus, categories: categoryExecution, alert, householdId: hid })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, reload: load }
}
