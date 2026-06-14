'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo } from '@/lib/dates'
import { getUserHousehold } from '@/lib/household'
import type { BudgetCategory, Transaction } from '@/types'

export interface Challenge {
  id: string
  icon: string
  title: string
  description: string
  progress: number      // 0-100
  current: number
  target: number
  unit: string
  status: 'on_track' | 'at_risk' | 'completed' | 'failed'
  category: 'spending' | 'saving' | 'habits'
}

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export function useDynamicChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('No autenticado'); return }

      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { setError('Sin hogar'); return }

      const hid = hh.id
      const now = new Date()
      const monthStart = localMonthStart()
      const today = localToday()
      const weekStart = localDaysAgo(6)

      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`
      const prev2MonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const prev2MonthStart = `${prev2MonthDate.getFullYear()}-${String(prev2MonthDate.getMonth() + 1).padStart(2, '0')}-01`

      const [txMonthRes, txPrevMonthRes, txPrev2MonthRes, categoriesRes, profileRes, tx30Res] = await Promise.all([
        supabase.from('transactions').select('amount,date,category_id').eq('household_id', hid).gte('date', monthStart),
        supabase.from('transactions').select('amount,date,category_id').eq('household_id', hid).gte('date', prevMonthStart).lt('date', monthStart),
        supabase.from('transactions').select('amount,category_id').eq('household_id', hid).gte('date', prev2MonthStart).lt('date', prevMonthStart),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('financial_profiles').select('total_income').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
        supabase.from('transactions').select('date').eq('household_id', hid).gte('date', localDaysAgo(30)),
      ])

      const txMonth = (txMonthRes.data ?? []) as Pick<Transaction, 'amount' | 'date' | 'category_id'>[]
      const txPrevMonth = (txPrevMonthRes.data ?? []) as Pick<Transaction, 'amount' | 'date' | 'category_id'>[]
      const txPrev2Month = (txPrev2MonthRes.data ?? []) as Pick<Transaction, 'amount' | 'category_id'>[]
      const categories = (categoriesRes.data ?? []) as BudgetCategory[]
      const totalIncome = profileRes.data ? Number(profileRes.data.total_income) : 0

      const catMap: Record<string, BudgetCategory> = {}
      categories.forEach(c => { catMap[c.id] = c })

      const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
      const spentPrevMonth = txPrevMonth.reduce((s, t) => s + Number(t.amount), 0)

      // Spending by category this month and last month
      const catSpentMonth: Record<string, number> = {}
      const catSpentPrev: Record<string, number> = {}
      const catSpentPrev2: Record<string, number> = {}
      txMonth.forEach(t => { catSpentMonth[t.category_id] = (catSpentMonth[t.category_id] ?? 0) + Number(t.amount) })
      txPrevMonth.forEach(t => { catSpentPrev[t.category_id] = (catSpentPrev[t.category_id] ?? 0) + Number(t.amount) })
      txPrev2Month.forEach(t => { catSpentPrev2[t.category_id] = (catSpentPrev2[t.category_id] ?? 0) + Number(t.amount) })

      // Days with transactions this month
      const txDatesMonth = new Set(txMonth.map(t => t.date))
      const tx30Dates = new Set((tx30Res.data ?? []).map((t: { date: string }) => t.date))

      // Current streak
      let currentStreak = 0
      let streakDay = tx30Dates.has(today) ? 0 : 1
      while (true) {
        const ds = localDaysAgo(streakDay)
        if (tx30Dates.has(ds)) { currentStreak++; streakDay++ } else break
      }

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daysPassed = now.getDate()

      const result: Challenge[] = []
      let id = 0

      // --- CHALLENGE 1: Biggest "wants" category reduction ---
      const wantsCategories = categories.filter(c => c.bucket === 'wants')
      let biggestWant: { cat: BudgetCategory; prevAvg: number; current: number } | null = null
      for (const cat of wantsCategories) {
        const prev = catSpentPrev[cat.id] ?? 0
        const prev2 = catSpentPrev2[cat.id] ?? 0
        const avg = (prev + prev2) / 2
        const current = catSpentMonth[cat.id] ?? 0
        if (avg > 0 && (!biggestWant || avg > biggestWant.prevAvg)) {
          biggestWant = { cat, prevAvg: avg, current }
        }
      }
      if (biggestWant && biggestWant.prevAvg > 100) {
        const target = Math.round(biggestWant.prevAvg * 0.8)
        const current = Math.round(biggestWant.current)
        const projectedAtRate = daysPassed > 0 ? Math.round((current / daysPassed) * daysInMonth) : 0
        const progress = target > 0 ? Math.min(Math.round(((target - current) / target) * 100), 100) : 0
        let status: Challenge['status'] = 'on_track'
        if (current >= target) status = 'failed'
        else if (projectedAtRate > target) status = 'at_risk'
        if (daysPassed >= daysInMonth && current <= target) status = 'completed'

        result.push({
          id: String(id++), icon: '🎯',
          title: `Reducí ${biggestWant.cat.name} un 20%`,
          description: `Tu promedio es Q${Math.round(biggestWant.prevAvg).toLocaleString()}/mes. Meta: no pasar de Q${target.toLocaleString()} este mes.`,
          progress: Math.max(progress, 0), current, target,
          unit: 'Q', status, category: 'spending',
        })
      }

      // --- CHALLENGE 2: Registration streak ---
      const streakTarget = 7
      const streakProgress = Math.min(Math.round((currentStreak / streakTarget) * 100), 100)
      result.push({
        id: String(id++), icon: '🔥',
        title: `Racha de ${streakTarget} días registrando`,
        description: currentStreak >= streakTarget
          ? `¡Llevás ${currentStreak} días seguidos! Seguí así.`
          : `Llevás ${currentStreak} día${currentStreak !== 1 ? 's' : ''} seguidos. Registrá hoy para no perder la racha.`,
        progress: streakProgress, current: currentStreak, target: streakTarget,
        unit: 'días', status: currentStreak >= streakTarget ? 'completed' : currentStreak > 0 ? 'on_track' : 'at_risk',
        category: 'habits',
      })

      // --- CHALLENGE 3: Monthly budget control ---
      const budget = totalIncome > 0 ? totalIncome * 0.8 : categories.reduce((s, c) => s + Number(c.budgeted_amount), 0)
      if (budget > 0) {
        const remaining = Math.max(budget - spentMonth, 0)
        const dailyAllowance = daysInMonth - daysPassed > 0 ? Math.round(remaining / (daysInMonth - daysPassed)) : 0
        const budgetProgress = Math.min(Math.round((spentMonth / budget) * 100), 100)
        const projectedTotal = daysPassed > 0 ? (spentMonth / daysPassed) * daysInMonth : 0
        let status: Challenge['status'] = 'on_track'
        if (spentMonth > budget) status = 'failed'
        else if (projectedTotal > budget) status = 'at_risk'
        if (daysPassed >= daysInMonth && spentMonth <= budget) status = 'completed'

        result.push({
          id: String(id++), icon: '💰',
          title: `No superar Q${Math.round(budget).toLocaleString()} en ${MONTH_NAMES[now.getMonth()]}`,
          description: status === 'at_risk'
            ? `Al ritmo actual llegarás a Q${Math.round(projectedTotal).toLocaleString()}. Tenés Q${dailyAllowance.toLocaleString()}/día disponible.`
            : `Llevas Q${Math.round(spentMonth).toLocaleString()} de Q${Math.round(budget).toLocaleString()}. Te quedan Q${dailyAllowance.toLocaleString()}/día.`,
          progress: budgetProgress, current: Math.round(spentMonth), target: Math.round(budget),
          unit: 'Q', status, category: 'spending',
        })
      }

      // --- CHALLENGE 4: Beat last month ---
      if (spentPrevMonth > 0) {
        const target = Math.round(spentPrevMonth)
        const current = Math.round(spentMonth)
        const projectedTotal = daysPassed > 0 ? Math.round((current / daysPassed) * daysInMonth) : 0
        const progress = Math.min(Math.round((current / target) * 100), 100)
        let status: Challenge['status'] = 'on_track'
        if (current > target) status = 'failed'
        else if (projectedTotal > target) status = 'at_risk'
        if (daysPassed >= daysInMonth && current <= target) status = 'completed'

        result.push({
          id: String(id++), icon: '📉',
          title: 'Gastá menos que el mes pasado',
          description: `En ${MONTH_NAMES[prevMonthDate.getMonth()]} gastaste Q${target.toLocaleString()}. Llevas Q${current.toLocaleString()} este mes.`,
          progress, current, target,
          unit: 'Q', status, category: 'spending',
        })
      }

      // --- CHALLENGE 5: Second biggest wants category (if exists) ---
      const wantsSorted = wantsCategories
        .map(c => ({ cat: c, prev: ((catSpentPrev[c.id] ?? 0) + (catSpentPrev2[c.id] ?? 0)) / 2, current: catSpentMonth[c.id] ?? 0 }))
        .filter(w => w.prev > 50)
        .sort((a, b) => b.prev - a.prev)

      if (wantsSorted.length >= 2) {
        const second = wantsSorted[1]
        const target = Math.round(second.prev * 0.85)
        const current = Math.round(second.current)
        const projectedAtRate = daysPassed > 0 ? Math.round((current / daysPassed) * daysInMonth) : 0
        const progress = target > 0 ? Math.min(Math.round(((target - current) / target) * 100), 100) : 0
        let status: Challenge['status'] = 'on_track'
        if (current >= target) status = 'failed'
        else if (projectedAtRate > target) status = 'at_risk'
        if (daysPassed >= daysInMonth && current <= target) status = 'completed'

        result.push({
          id: String(id++), icon: '✂️',
          title: `Reducí ${second.cat.name} un 15%`,
          description: `Promedio: Q${Math.round(second.prev).toLocaleString()}/mes. Meta: Q${target.toLocaleString()} este mes.`,
          progress: Math.max(progress, 0), current, target,
          unit: 'Q', status, category: 'spending',
        })
      }

      // --- CHALLENGE 6: Days with registrations this month ---
      const daysRegistered = txDatesMonth.size
      const regTarget = Math.min(daysInMonth, 20)
      const regProgress = Math.min(Math.round((daysRegistered / regTarget) * 100), 100)
      result.push({
        id: String(id++), icon: '📝',
        title: `Registrá gastos ${regTarget} días este mes`,
        description: `Llevas ${daysRegistered} de ${regTarget} días. ${daysRegistered >= regTarget ? '¡Meta alcanzada!' : 'Cada día cuenta.'}`,
        progress: regProgress, current: daysRegistered, target: regTarget,
        unit: 'días', status: daysRegistered >= regTarget ? 'completed' : daysRegistered >= daysPassed * 0.6 ? 'on_track' : 'at_risk',
        category: 'habits',
      })

      // Sort: at_risk first, then on_track, then completed, then failed
      const statusOrder: Record<string, number> = { at_risk: 0, on_track: 1, completed: 2, failed: 3 }
      result.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

      setChallenges(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { challenges, loading, error }
}
