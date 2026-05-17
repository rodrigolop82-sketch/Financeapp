'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
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
  pct: number
  bucket: string
}

export interface HistoricalTrendsData {
  monthPoints: MonthPoint[]
  topCategories: CategoryShare[]
  fixedTotal: number
  variableTotal: number
  avgMonthly: number
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

      // Top 6 categories by spend
      const topCategories: CategoryShare[] = Object.entries(catTotals)
        .map(([catId, amount]) => {
          const cat = catMap[catId]
          return {
            name: cat?.name ?? 'Otros',
            amount,
            pct: grandTotal > 0 ? Math.round(amount / grandTotal * 100) : 0,
            bucket: cat?.bucket ?? 'wants',
          }
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6)

      setData({ monthPoints: monthGrid, topCategories, fixedTotal, variableTotal, avgMonthly })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error }
}
