'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/format'
import type { BudgetCategory, Transaction } from '@/types'

export interface MonthPoint {
  month: string      // 'Ene', 'Feb', ...
  year: number
  total: number
  fixed: number
  variable: number
}

export interface CategoryShare {
  name: string
  amount: number
  monthlyAvg: number
  pct: number
  bucket: string
}

export interface SpendingObservation {
  type: 'warning' | 'tip' | 'positive'
  message: string
}

export interface HistoricalTrendsData {
  monthPoints: MonthPoint[]
  topCategories: CategoryShare[]
  fixedTotal: number
  variableTotal: number
  fixedMonthlyAvg: number
  variableMonthlyAvg: number
  avgMonthly: number
  observations: SpendingObservation[]
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function useHistoricalTrends() {
  const [data, setData] = useState<HistoricalTrendsData | null>(null)
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

      // 6 months back from start of current month
      const now = new Date()
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

      const [txRes, categoriesRes] = await Promise.all([
        supabase.from('transactions').select('amount,date,category_id').eq('household_id', hid).gte('date', startDate).order('date', { ascending: true }),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
      ])

      const transactions = (txRes.data ?? []) as Pick<Transaction, 'amount' | 'date' | 'category_id'>[]
      const categories = (categoriesRes.data ?? []) as BudgetCategory[]

      const catMap: Record<string, BudgetCategory> = {}
      categories.forEach((c) => { catMap[c.id] = c })

      // Build 6-month grid (including current month, even if partial)
      const monthGrid: MonthPoint[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthGrid.push({
          month: MONTH_NAMES[d.getMonth()],
          year: d.getFullYear(),
          total: 0,
          fixed: 0,
          variable: 0,
        })
      }
      const monthIndexMap: Record<string, number> = {}
      monthGrid.forEach((mp, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
        monthIndexMap[monthKey(d)] = idx
      })

      // Aggregate by category for top categories (last 6 months)
      const catTotals: Record<string, number> = {}

      transactions.forEach((t) => {
        const d = new Date(t.date + 'T12:00:00')
        const key = monthKey(d)
        const idx = monthIndexMap[key]
        const amt = Number(t.amount)
        const cat = catMap[t.category_id]
        const bucket = cat?.bucket ?? 'wants'
        const isFixed = bucket === 'needs' || bucket === 'savings'

        if (idx !== undefined) {
          monthGrid[idx].total += amt
          if (isFixed) monthGrid[idx].fixed += amt
          else monthGrid[idx].variable += amt
        }

        catTotals[t.category_id] = (catTotals[t.category_id] ?? 0) + amt
      })

      // Round values
      monthGrid.forEach((mp) => {
        mp.total = Math.round(mp.total * 100) / 100
        mp.fixed = Math.round(mp.fixed * 100) / 100
        mp.variable = Math.round(mp.variable * 100) / 100
      })

      const grandTotal = monthGrid.reduce((s, m) => s + m.total, 0)
      const avgMonthly = monthGrid.length > 0 ? grandTotal / monthGrid.length : 0

      const fixedTotal = monthGrid.reduce((s, m) => s + m.fixed, 0)
      const variableTotal = monthGrid.reduce((s, m) => s + m.variable, 0)

      const completedMonths = monthGrid.filter((_, i) => i < monthGrid.length - 1)
      const numCompleted = Math.max(completedMonths.length, 1)
      const fixedMonthlyAvg = Math.round(fixedTotal / numCompleted)
      const variableMonthlyAvg = Math.round(variableTotal / numCompleted)

      // Top 6 categories by spend with monthly average
      const topCategories: CategoryShare[] = Object.entries(catTotals)
        .map(([catId, amount]) => {
          const cat = catMap[catId]
          return {
            name: cat?.name ?? 'Otros',
            amount,
            monthlyAvg: Math.round(amount / numCompleted),
            pct: grandTotal > 0 ? Math.round(amount / grandTotal * 100) : 0,
            bucket: cat?.bucket ?? 'wants',
          }
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8)

      // Generate observations
      const observations: SpendingObservation[] = []

      // 1. Compare wants categories vs needs categories of similar or higher spend
      const wantsCategories = topCategories.filter(c => c.bucket === 'wants')
      const needsCategories = topCategories.filter(c => c.bucket === 'needs')

      for (const want of wantsCategories) {
        for (const need of needsCategories) {
          if (want.amount >= need.amount * 0.8 && need.amount > 0 && want.amount > 0) {
            observations.push({
              type: 'warning',
              message: `Gastás casi lo mismo en ${want.name} (${formatMoney(want.monthlyAvg)}/mes) que en ${need.name} (${formatMoney(need.monthlyAvg)}/mes). Considerá reducir ${want.name}.`,
            })
          }
        }
      }

      // 2. Variable spending growing
      if (completedMonths.length >= 3) {
        const recent3 = completedMonths.slice(-3)
        const older = completedMonths.slice(0, -3)
        if (older.length > 0) {
          const recentVarAvg = recent3.reduce((s, m) => s + m.variable, 0) / recent3.length
          const olderVarAvg = older.reduce((s, m) => s + m.variable, 0) / older.length
          if (olderVarAvg > 0 && recentVarAvg > olderVarAvg * 1.15) {
            const pctUp = Math.round(((recentVarAvg - olderVarAvg) / olderVarAvg) * 100)
            observations.push({
              type: 'warning',
              message: `Tu gasto variable ha subido ${pctUp}% en los últimos 3 meses. Revisá categorías como ${wantsCategories[0]?.name ?? 'entretenimiento'}.`,
            })
          }
        }
      }

      // 3. Biggest wants category
      if (wantsCategories.length > 0) {
        const biggest = wantsCategories[0]
        if (biggest.pct >= 15) {
          observations.push({
            type: 'tip',
            message: `${biggest.name} representa el ${biggest.pct}% de tu gasto total (${formatMoney(biggest.monthlyAvg)}/mes). Reducirlo un 20% te ahorraría ${formatMoney(Math.round(biggest.monthlyAvg * 0.2))}/mes.`,
          })
        }
      }

      // 4. Fixed expenses ratio
      const fixedRatio = grandTotal > 0 ? fixedTotal / grandTotal : 0
      if (fixedRatio > 0.7) {
        observations.push({
          type: 'warning',
          message: `Tus gastos fijos son el ${Math.round(fixedRatio * 100)}% del total. Lo ideal es que no superen el 60%. Revisá si podés renegociar algún servicio.`,
        })
      } else if (fixedRatio < 0.5 && fixedRatio > 0) {
        observations.push({
          type: 'positive',
          message: `Tus gastos fijos son solo el ${Math.round(fixedRatio * 100)}% del total. Eso te da flexibilidad para ahorrar más.`,
        })
      }

      // Limit to top 4 most relevant
      const limitedObs = observations.slice(0, 4)

      setData({ monthPoints: monthGrid, topCategories, fixedTotal, variableTotal, fixedMonthlyAvg, variableMonthlyAvg, avgMonthly, observations: limitedObs })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error }
}
