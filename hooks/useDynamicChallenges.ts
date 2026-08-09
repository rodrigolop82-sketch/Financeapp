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
  progress: number
  current: number
  target: number
  unit: string
  status: 'on_track' | 'at_risk' | 'completed' | 'failed'
  category: 'spending' | 'saving' | 'habits'
  priority: number // lower = more important, used for sorting
}

type TxRow = Pick<Transaction, 'amount' | 'date' | 'category_id'>

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function calcStatus(current: number, target: number, projected: number, daysPassed: number, daysInMonth: number, inverted = false): Challenge['status'] {
  if (inverted) {
    // For "spend less" challenges: current should stay below target
    if (current > target) return 'failed'
    if (daysPassed >= daysInMonth && current <= target) return 'completed'
    if (projected > target) return 'at_risk'
    return 'on_track'
  }
  // For "reach X" challenges: current should reach target
  if (current >= target) return 'completed'
  const projectedProgress = daysPassed > 0 ? (current / daysPassed) * daysInMonth : 0
  if (projectedProgress < target * 0.6) return 'at_risk'
  return 'on_track'
}

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

      // Build date ranges for last 3 months
      const months: { start: string; end: string }[] = []
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        months.push({
          start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
          end: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`,
        })
      }

      const threeMonthsAgo = months[2].start

      const [txAllRes, categoriesRes, profileRes, tx60Res] = await Promise.all([
        supabase.from('transactions').select('amount,date,category_id').eq('household_id', hid).gte('date', threeMonthsAgo).order('date', { ascending: true }),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('financial_profiles').select('total_income').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
        supabase.from('transactions').select('date').eq('household_id', hid).gte('date', localDaysAgo(60)),
      ])

      const txAll = (txAllRes.data ?? []) as TxRow[]
      const categories = (categoriesRes.data ?? []) as BudgetCategory[]
      const totalIncome = profileRes.data ? Number(profileRes.data.total_income) : 0
      const tx60Dates = (tx60Res.data ?? []).map((t: { date: string }) => t.date)

      const catMap: Record<string, BudgetCategory> = {}
      categories.forEach(c => { catMap[c.id] = c })

      // Split transactions by month
      const txByMonth: TxRow[][] = months.map(m =>
        txAll.filter(t => t.date >= m.start && t.date < m.end)
      )
      const [txMonth, txPrev, txPrev2] = txByMonth

      // Aggregate by category per month
      const catTotals = (txs: TxRow[]): Record<string, number> => {
        const r: Record<string, number> = {}
        txs.forEach(t => { r[t.category_id] = (r[t.category_id] ?? 0) + Number(t.amount) })
        return r
      }
      const catMonth = catTotals(txMonth)
      const catPrev = catTotals(txPrev)
      const catPrev2 = catTotals(txPrev2)

      const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
      const spentPrev = txPrev.reduce((s, t) => s + Number(t.amount), 0)

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daysPassed = now.getDate()
      const daysLeft = daysInMonth - daysPassed

      // Transaction dates
      const txDatesMonth = new Set(txMonth.map(t => t.date))
      const tx60Set = new Set(tx60Dates)

      // Current streak
      let currentStreak = 0
      let sd = tx60Set.has(today) ? 0 : 1
      while (tx60Set.has(localDaysAgo(sd))) { currentStreak++; sd++ }

      // Weekend vs weekday spending this month
      const weekendSpend = txMonth
        .filter(t => { const d = new Date(t.date + 'T12:00:00'); return d.getDay() === 0 || d.getDay() === 6 })
        .reduce((s, t) => s + Number(t.amount), 0)
      const weekdaySpend = spentMonth - weekendSpend
      let weekendDaysSoFar = 0
      for (let i = 0; i < daysPassed; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
        if (d.getDay() === 0 || d.getDay() === 6) weekendDaysSoFar++
      }
      const weekdayDaysSoFar = daysPassed - weekendDaysSoFar

      // Heaviest spending day of week (from last 2 months)
      const dayOfWeekTotals: number[] = [0, 0, 0, 0, 0, 0, 0]
      const dayOfWeekCounts: number[] = [0, 0, 0, 0, 0, 0, 0]
      ;[...txPrev, ...txPrev2].forEach(t => {
        const d = new Date(t.date + 'T12:00:00')
        const dow = d.getDay()
        dayOfWeekTotals[dow] += Number(t.amount)
        dayOfWeekCounts[dow]++
      })

      const budget = totalIncome > 0 ? totalIncome * 0.8 : categories.reduce((s, c) => s + Number(c.budgeted_amount), 0)

      const result: Challenge[] = []
      let id = 0

      // ============================================================
      // PATTERN 1: Categories trending UP over 3 months
      // ============================================================
      const trendingUp: { cat: BudgetCategory; m0: number; m1: number; m2: number; growth: number }[] = []
      for (const cat of categories) {
        const m2 = catPrev2[cat.id] ?? 0
        const m1 = catPrev[cat.id] ?? 0
        const m0 = catMonth[cat.id] ?? 0
        if (m2 > 50 && m1 > m2 && m0 > m1 * (daysPassed / daysInMonth) * 0.9) {
          const growth = Math.round(((m1 - m2) / m2) * 100)
          trendingUp.push({ cat, m0, m1, m2, growth })
        }
      }
      trendingUp.sort((a, b) => b.growth - a.growth)

      if (trendingUp.length > 0) {
        const t = trendingUp[0]
        const target = Math.round(t.m2)
        const current = Math.round(t.m0)
        const projected = daysPassed > 0 ? Math.round((current / daysPassed) * daysInMonth) : 0

        result.push({
          id: String(id++), icon: '📈',
          title: `Frená el crecimiento en ${t.cat.name}`,
          description: `${t.cat.name} viene subiendo: Q${Math.round(t.m2).toLocaleString()} → Q${Math.round(t.m1).toLocaleString()} (+${t.growth}%). Meta: volver a Q${target.toLocaleString()}.`,
          progress: target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0,
          current, target, unit: 'Q',
          status: calcStatus(current, target, projected, daysPassed, daysInMonth, true),
          category: 'spending', priority: 1,
        })
      }

      // ============================================================
      // PATTERN 2: Weekend spending spike
      // ============================================================
      if (weekendDaysSoFar > 0 && weekdayDaysSoFar > 0) {
        const weekendDailyAvg = weekendSpend / weekendDaysSoFar
        const weekdayDailyAvg = weekdaySpend / weekdayDaysSoFar
        if (weekendDailyAvg > weekdayDailyAvg * 1.5 && weekendSpend > 200) {
          const ratio = Math.round((weekendDailyAvg / weekdayDailyAvg) * 10) / 10
          const weekendTarget = Math.round(weekdayDailyAvg * 1.2)
          let totalWeekendsInMonth = 0
          for (let i = 0; i < daysInMonth; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
            if (d.getDay() === 0 || d.getDay() === 6) totalWeekendsInMonth++
          }
          const weekendBudget = weekendTarget * totalWeekendsInMonth
          const progress = weekendBudget > 0 ? Math.min(Math.round((weekendSpend / weekendBudget) * 100), 100) : 0
          const projected = weekendDaysSoFar > 0 ? (weekendSpend / weekendDaysSoFar) * totalWeekendsInMonth : 0

          result.push({
            id: String(id++), icon: '🗓️',
            title: 'Controlá el gasto de fin de semana',
            description: `Gastás ${ratio}x más los fines de semana (Q${Math.round(weekendDailyAvg).toLocaleString()}/día vs Q${Math.round(weekdayDailyAvg).toLocaleString()}/día entre semana). Meta: no pasar de Q${Math.round(weekendTarget).toLocaleString()}/día.`,
            progress, current: Math.round(weekendSpend), target: Math.round(weekendBudget), unit: 'Q',
            status: calcStatus(weekendSpend, weekendBudget, projected, daysPassed, daysInMonth, true),
            category: 'spending', priority: 2,
          })
        }
      }

      // ============================================================
      // PATTERN 3: Category consistently over budget
      // ============================================================
      const overBudgetCats: { cat: BudgetCategory; avgOver: number; currentPct: number }[] = []
      for (const cat of categories) {
        if (cat.budgeted_amount <= 0 || cat.bucket === 'savings') continue
        const prev1Pct = catPrev[cat.id] ? (catPrev[cat.id] / cat.budgeted_amount) * 100 : 0
        const prev2Pct = catPrev2[cat.id] ? (catPrev2[cat.id] / cat.budgeted_amount) * 100 : 0
        const currPct = catMonth[cat.id] ? (catMonth[cat.id] / cat.budgeted_amount) * 100 : 0
        if (prev1Pct > 100 && prev2Pct > 100) {
          overBudgetCats.push({ cat, avgOver: (prev1Pct + prev2Pct) / 2, currentPct: currPct })
        }
      }
      overBudgetCats.sort((a, b) => b.avgOver - a.avgOver)

      if (overBudgetCats.length > 0) {
        const obc = overBudgetCats[0]
        const target = Math.round(obc.cat.budgeted_amount)
        const current = Math.round(catMonth[obc.cat.id] ?? 0)
        const projected = daysPassed > 0 ? Math.round((current / daysPassed) * daysInMonth) : 0

        result.push({
          id: String(id++), icon: '🚨',
          title: `Por fin cumplí el presupuesto de ${obc.cat.name}`,
          description: `Llevas 2 meses seguidos pasándote en ${obc.cat.name}. Tu límite es Q${target.toLocaleString()}. Este mes llevas Q${current.toLocaleString()}.`,
          progress: target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0,
          current, target, unit: 'Q',
          status: calcStatus(current, target, projected, daysPassed, daysInMonth, true),
          category: 'spending', priority: 1,
        })
      }

      // ============================================================
      // PATTERN 4: Biggest wants category — smart reduction target
      // ============================================================
      const wantsAnalysis = categories
        .filter(c => c.bucket === 'wants')
        .map(c => {
          const prev = (catPrev[c.id] ?? 0)
          const prev2 = (catPrev2[c.id] ?? 0)
          const avg = (prev + prev2) / 2
          const current = catMonth[c.id] ?? 0
          const alreadyInTrending = trendingUp.some(t => t.cat.id === c.id)
          const alreadyInOverBudget = overBudgetCats.some(o => o.cat.id === c.id)
          return { cat: c, avg, current, alreadyUsed: alreadyInTrending || alreadyInOverBudget }
        })
        .filter(w => w.avg > 100 && !w.alreadyUsed)
        .sort((a, b) => b.avg - a.avg)

      if (wantsAnalysis.length > 0) {
        const w = wantsAnalysis[0]
        // Adaptive reduction: if already under avg, celebrate. If way over, suggest 10%. If slightly over, 20%.
        const projected = daysPassed > 0 ? Math.round((w.current / daysPassed) * daysInMonth) : 0
        const isAlreadyBeating = projected < w.avg * 0.9
        const reductionPct = projected > w.avg * 1.3 ? 10 : 20
        const target = Math.round(w.avg * (1 - reductionPct / 100))
        const current = Math.round(w.current)

        if (isAlreadyBeating && w.current > 0) {
          result.push({
            id: String(id++), icon: '⭐',
            title: `${w.cat.name} va mejor que nunca`,
            description: `Promedio: Q${Math.round(w.avg).toLocaleString()}/mes. Este mes llevas Q${current.toLocaleString()}. ¡Seguí así!`,
            progress: 100, current, target: Math.round(w.avg), unit: 'Q',
            status: 'completed', category: 'spending', priority: 5,
          })
        } else {
          result.push({
            id: String(id++), icon: '🎯',
            title: `Reducí ${w.cat.name} un ${reductionPct}%`,
            description: `Tu promedio es Q${Math.round(w.avg).toLocaleString()}/mes. Meta: no pasar de Q${target.toLocaleString()} este mes.`,
            progress: target > 0 ? Math.max(Math.min(Math.round(((target - current) / target) * 100), 100), 0) : 0,
            current, target, unit: 'Q',
            status: calcStatus(current, target, projected, daysPassed, daysInMonth, true),
            category: 'spending', priority: 3,
          })
        }
      }

      // ============================================================
      // PATTERN 5: Heaviest day of week awareness
      // ============================================================
      const maxDowIdx = dayOfWeekTotals.indexOf(Math.max(...dayOfWeekTotals))
      const avgDowSpend = dayOfWeekTotals.reduce((s, v) => s + v, 0) / 7
      if (dayOfWeekTotals[maxDowIdx] > avgDowSpend * 1.8 && avgDowSpend > 0) {
        const heavyDay = DAY_NAMES[maxDowIdx]
        const heavyDayAvg = dayOfWeekCounts[maxDowIdx] > 0 ? Math.round(dayOfWeekTotals[maxDowIdx] / dayOfWeekCounts[maxDowIdx]) : 0
        const otherAvg = Math.round(avgDowSpend / (dayOfWeekCounts.reduce((s, v) => s + v, 0) / 7 || 1))
        // Count this month's heavy-day spending
        const heavyDaySpentThisMonth = txMonth
          .filter(t => new Date(t.date + 'T12:00:00').getDay() === maxDowIdx)
          .reduce((s, t) => s + Number(t.amount), 0)
        let heavyDaysThisMonth = 0
        for (let i = 0; i < daysPassed; i++) {
          if (new Date(now.getFullYear(), now.getMonth(), i + 1).getDay() === maxDowIdx) heavyDaysThisMonth++
        }
        const target = Math.round(heavyDayAvg * 0.75)
        const currentAvg = heavyDaysThisMonth > 0 ? Math.round(heavyDaySpentThisMonth / heavyDaysThisMonth) : 0

        if (heavyDaysThisMonth > 0) {
          result.push({
            id: String(id++), icon: '📅',
            title: `Cuidado con los ${heavyDay}`,
            description: `Históricamente gastás Q${heavyDayAvg.toLocaleString()} cada ${heavyDay}. Este mes: Q${currentAvg.toLocaleString()} promedio. Meta: Q${target.toLocaleString()}.`,
            progress: target > 0 ? Math.min(Math.round((currentAvg / target) * 100), 100) : 0,
            current: currentAvg, target, unit: 'Q',
            status: currentAvg <= target ? (currentAvg <= target * 0.8 ? 'completed' : 'on_track') : 'at_risk',
            category: 'spending', priority: 4,
          })
        }
      }

      // ============================================================
      // PATTERN 6: Savings goal — are savings categories being funded?
      // ============================================================
      const savingsCategories = categories.filter(c => c.bucket === 'savings' && c.budgeted_amount > 0)
      if (savingsCategories.length > 0) {
        const totalSavingsBudget = savingsCategories.reduce((s, c) => s + c.budgeted_amount, 0)
        const totalSavingsSpent = savingsCategories.reduce((s, c) => s + (catMonth[c.id] ?? 0), 0)
        const projectedSavings = daysPassed > 0 ? (totalSavingsSpent / daysPassed) * daysInMonth : 0
        const progress = totalSavingsBudget > 0 ? Math.min(Math.round((totalSavingsSpent / totalSavingsBudget) * 100), 100) : 0

        result.push({
          id: String(id++), icon: '🐷',
          title: `Ahorrá Q${Math.round(totalSavingsBudget).toLocaleString()} este mes`,
          description: totalSavingsSpent >= totalSavingsBudget
            ? `¡Meta alcanzada! Llevas Q${Math.round(totalSavingsSpent).toLocaleString()} ahorrados.`
            : `Llevas Q${Math.round(totalSavingsSpent).toLocaleString()} de Q${Math.round(totalSavingsBudget).toLocaleString()}. Faltan Q${Math.round(totalSavingsBudget - totalSavingsSpent).toLocaleString()}.`,
          progress, current: Math.round(totalSavingsSpent), target: Math.round(totalSavingsBudget), unit: 'Q',
          status: calcStatus(totalSavingsSpent, totalSavingsBudget, projectedSavings, daysPassed, daysInMonth),
          category: 'saving', priority: 2,
        })
      }

      // ============================================================
      // PATTERN 7: Monthly budget control (always present)
      // ============================================================
      if (budget > 0) {
        const remaining = Math.max(budget - spentMonth, 0)
        const dailyAllowance = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0
        const projected = daysPassed > 0 ? (spentMonth / daysPassed) * daysInMonth : 0

        result.push({
          id: String(id++), icon: '💰',
          title: `No superar Q${Math.round(budget).toLocaleString()} en ${MONTH_NAMES[now.getMonth()]}`,
          description: projected > budget
            ? `Al ritmo actual llegarás a Q${Math.round(projected).toLocaleString()}. Tenés Q${dailyAllowance.toLocaleString()}/día disponible.`
            : `Llevas Q${Math.round(spentMonth).toLocaleString()} de Q${Math.round(budget).toLocaleString()}. Te quedan Q${dailyAllowance.toLocaleString()}/día.`,
          progress: Math.min(Math.round((spentMonth / budget) * 100), 100),
          current: Math.round(spentMonth), target: Math.round(budget), unit: 'Q',
          status: calcStatus(spentMonth, budget, projected, daysPassed, daysInMonth, true),
          category: 'spending', priority: 3,
        })
      }

      // ============================================================
      // PATTERN 8: Registration streak (adaptive target)
      // ============================================================
      const bestStreakLast60 = (() => {
        const sorted = Array.from(new Set(tx60Dates)).sort()
        let best = 0, temp = 0, prev: string | null = null
        for (const d of sorted) {
          if (prev === null) { temp = 1 }
          else {
            const diff = Math.round((new Date(d + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime()) / 86400000)
            temp = diff === 1 ? temp + 1 : 1
          }
          best = Math.max(best, temp)
          prev = d
        }
        return best
      })()

      // Adaptive: if best streak is 3, target 5. If 7, target 10. If 14+, target 21.
      const streakTarget = bestStreakLast60 >= 14 ? 21 : bestStreakLast60 >= 7 ? 14 : bestStreakLast60 >= 3 ? 7 : 5

      result.push({
        id: String(id++), icon: '🔥',
        title: `Racha de ${streakTarget} días registrando`,
        description: currentStreak >= streakTarget
          ? `¡Llevás ${currentStreak} días seguidos! Tu mejor racha fue ${bestStreakLast60} días.`
          : `Llevás ${currentStreak} día${currentStreak !== 1 ? 's' : ''} (mejor: ${bestStreakLast60}). ${currentStreak === 0 ? 'Registrá hoy para empezar.' : 'No pierdas la racha.'}`,
        progress: Math.min(Math.round((currentStreak / streakTarget) * 100), 100),
        current: currentStreak, target: streakTarget, unit: 'días',
        status: currentStreak >= streakTarget ? 'completed' : currentStreak > 0 ? 'on_track' : 'at_risk',
        category: 'habits', priority: 3,
      })

      // ============================================================
      // PATTERN 9: Beat last month (only if relevant)
      // ============================================================
      if (spentPrev > 0) {
        const projected = daysPassed > 0 ? Math.round((spentMonth / daysPassed) * daysInMonth) : 0
        const pctOfPrev = Math.round((projected / spentPrev) * 100)

        // Only show if it's achievable (within 30% of last month) or already beating
        if (pctOfPrev < 130) {
          result.push({
            id: String(id++), icon: '📉',
            title: 'Gastá menos que el mes pasado',
            description: `En ${MONTH_NAMES[new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()]} gastaste Q${Math.round(spentPrev).toLocaleString()}. Proyección: Q${projected.toLocaleString()}.`,
            progress: Math.min(Math.round((spentMonth / spentPrev) * 100), 100),
            current: Math.round(spentMonth), target: Math.round(spentPrev), unit: 'Q',
            status: calcStatus(spentMonth, spentPrev, projected, daysPassed, daysInMonth, true),
            category: 'spending', priority: 4,
          })
        }
      }

      // ============================================================
      // PATTERN 10: No-spend day challenge (if high frequency spender)
      // ============================================================
      const avgTxPerDay = daysPassed > 0 ? txMonth.length / daysPassed : 0
      if (avgTxPerDay >= 2) {
        const noSpendDays = daysPassed - txDatesMonth.size
        const noSpendTarget = Math.max(Math.round(daysInMonth * 0.2), 4) // aim for 20% of days
        const progress = Math.min(Math.round((noSpendDays / noSpendTarget) * 100), 100)

        result.push({
          id: String(id++), icon: '🧘',
          title: `${noSpendTarget} días sin gastar este mes`,
          description: `Registrás gastos casi todos los días. Llevas ${noSpendDays} día${noSpendDays !== 1 ? 's' : ''} sin gastar. Meta: ${noSpendTarget}.`,
          progress, current: noSpendDays, target: noSpendTarget, unit: 'días',
          status: calcStatus(noSpendDays, noSpendTarget, daysPassed > 0 ? (noSpendDays / daysPassed) * daysInMonth : 0, daysPassed, daysInMonth),
          category: 'habits', priority: 4,
        })
      }

      // Sort by priority, then at_risk first within same priority
      const statusOrder: Record<string, number> = { at_risk: 0, on_track: 1, failed: 2, completed: 3 }
      result.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return statusOrder[a.status] - statusOrder[b.status]
      })

      // Limit to top 6 most relevant
      setChallenges(result.slice(0, 6))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return { challenges, loading, error }
}
