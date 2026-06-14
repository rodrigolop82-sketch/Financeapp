'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localMonthStart } from '@/lib/dates'
import type { BudgetCategory, Transaction } from '@/types'

export interface CategoryInsight {
  name: string
  categoryId: string
  bucket: string
  thisMonth: number
  avgLast3: number
  lastMonth: number
  delta: number
  deltaPct: number
  savingsPotential: number
  trend: number[]
}

export interface InsightsData {
  totalThisMonth: number
  totalLastMonth: number
  monthDelta: number
  monthDeltaPct: number
  categoryInsights: CategoryInsight[]
  topIncreases: CategoryInsight[]
  savingsOpportunities: CategoryInsight[]
  topCategoryByDay: { day: string; category: string; amount: number }[]
}

const MONTH_GRID_SIZE = 6
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function useInsights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('No autenticado'); return }

      const household = await getUserHousehold(supabase, user.id)
      if (!household) { setError('Sin hogar'); return }
      const hid = household.id as string

      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth() - (MONTH_GRID_SIZE - 1), 1)
      const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`

      const [txRes, categoriesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount,date,category_id')
          .eq('household_id', hid)
          .gte('date', startStr)
          .order('date', { ascending: true }),
        supabase
          .from('budget_categories')
          .select('*')
          .eq('household_id', hid),
      ])

      const transactions = (txRes.data ?? []) as Pick<Transaction, 'amount' | 'date' | 'category_id'>[]
      const categories = (categoriesRes.data ?? []) as BudgetCategory[]

      const catMap: Record<string, BudgetCategory> = {}
      categories.forEach(c => { catMap[c.id] = c })

      const currentMs = localMonthStart()
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMs = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`

      // Build monthly totals per category
      const monthlyByCat: Record<string, Record<string, number>> = {}
      const dayOfWeekTotals: Record<number, Record<string, number>> = {}

      transactions.forEach(t => {
        const amt = Number(t.amount)
        const d = new Date(t.date + 'T12:00:00')
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const catId = t.category_id

        if (!monthlyByCat[catId]) monthlyByCat[catId] = {}
        monthlyByCat[catId][mk] = (monthlyByCat[catId][mk] ?? 0) + amt

        // Day of week analysis (current month only)
        if (t.date >= currentMs) {
          const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
          if (!dayOfWeekTotals[dow]) dayOfWeekTotals[dow] = {}
          dayOfWeekTotals[dow][catId] = (dayOfWeekTotals[dow][catId] ?? 0) + amt
        }
      })

      // Build month keys for last 6 months
      const monthKeys: string[] = []
      for (let i = MONTH_GRID_SIZE - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }

      const currentMk = monthKeys[monthKeys.length - 1]
      const prevMk = monthKeys[monthKeys.length - 2]
      const historicalMks = monthKeys.slice(0, -1)

      // Per-category insights
      const categoryInsights: CategoryInsight[] = categories.map(c => {
        const byMonth = monthlyByCat[c.id] ?? {}
        const thisMonth = byMonth[currentMk] ?? 0
        const lastMonth = byMonth[prevMk] ?? 0

        const historicalValues = historicalMks.map(mk => byMonth[mk] ?? 0)
        const nonZeroHistorical = historicalValues.filter(v => v > 0)
        const avgLast = nonZeroHistorical.length > 0
          ? nonZeroHistorical.reduce((s, v) => s + v, 0) / nonZeroHistorical.length
          : 0

        const trend = monthKeys.map(mk => byMonth[mk] ?? 0)
        const delta = thisMonth - lastMonth
        const deltaPct = lastMonth > 0 ? Math.round((delta / lastMonth) * 100) : 0
        const savingsPotential = thisMonth > avgLast ? Math.round(thisMonth - avgLast) : 0

        return {
          name: c.name,
          categoryId: c.id,
          bucket: c.bucket,
          thisMonth,
          avgLast3: Math.round(avgLast),
          lastMonth,
          delta,
          deltaPct,
          savingsPotential,
          trend,
        }
      }).filter(c => c.thisMonth > 0 || c.lastMonth > 0)
        .sort((a, b) => b.thisMonth - a.thisMonth)

      // Overall month comparison
      const totalThisMonth = categoryInsights.reduce((s, c) => s + c.thisMonth, 0)
      const totalLastMonth = categoryInsights.reduce((s, c) => s + c.lastMonth, 0)
      const monthDelta = totalThisMonth - totalLastMonth
      const monthDeltaPct = totalLastMonth > 0 ? Math.round((monthDelta / totalLastMonth) * 100) : 0

      // Top increases (categories that grew the most)
      const topIncreases = [...categoryInsights]
        .filter(c => c.delta > 0 && c.lastMonth > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5)

      // Savings opportunities (spending above historical average)
      const savingsOpportunities = [...categoryInsights]
        .filter(c => c.savingsPotential > 50 && c.avgLast3 > 0)
        .sort((a, b) => b.savingsPotential - a.savingsPotential)
        .slice(0, 5)

      // Day of week top category
      const topCategoryByDay = DAY_NAMES.map((day, i) => {
        const cats = dayOfWeekTotals[i] ?? {}
        let topCat = ''
        let topAmt = 0
        Object.entries(cats).forEach(([catId, amt]) => {
          if (amt > topAmt) {
            topAmt = amt
            topCat = catMap[catId]?.name ?? 'Otros'
          }
        })
        return { day, category: topCat || '—', amount: topAmt }
      })

      setData({
        totalThisMonth,
        totalLastMonth,
        monthDelta,
        monthDeltaPct,
        categoryInsights,
        topIncreases,
        savingsOpportunities,
        topCategoryByDay,
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error }
}
